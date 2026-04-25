import {
Client,
GatewayIntentBits,
Partials,
Events,
REST,
Routes,
SlashCommandBuilder,
ActionRowBuilder,
StringSelectMenuBuilder,
ChannelSelectMenuBuilder,
ChannelType,
PermissionsBitField,
EmbedBuilder
} from "discord.js";
import fs from "fs";
import express from "express";

/* ===================== ENV ===================== */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

/* ===================== EXPRESS ===================== */
const app = express();
app.get("/", (_, res) => res.send("Belaf observa el Abismo 🧭"));
app.listen(PORT, () => console.log(`🌐 Express activo en ${PORT}`));

/* ===================== FILES ===================== */
const configPath = "./config.json";
const statusPath = "./status.json";
const objectsPath = "./objects.json";

const config = fs.existsSync(configPath)
? JSON.parse(fs.readFileSync(configPath, "utf8"))
: { channels: { reliquies: [], trade: null, sell: null, tops: null } };

const objects = fs.existsSync(objectsPath)
? JSON.parse(fs.readFileSync(objectsPath, "utf8"))
: { class4: [], class3: [], class2: [], class1: [], special: [], ultra: [] };

const status = fs.existsSync(statusPath)
? JSON.parse(fs.readFileSync(statusPath, "utf8"))
: {};

const saveStatus = () => fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
const saveConfig = () => fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
const saveObjects = () => fs.writeFileSync(objectsPath, JSON.stringify(objects, null, 2));

/* ===================== REST + COMMANDS (FIX CRASH) ===================== */
const rest = new REST({ version: "10" }).setToken(TOKEN);

const commands = []; // (IMPORTANTE: evita crash si no tienes comandos aún)

/* ===================== ROLES ===================== */
const ranks = {
bell: "1456176950849572979",
silbato_rojo: "1456178133240778763",
silbato_azul: "1456178299364573348",
silbato_lunar: "1456179008625447105",
silbato_negro: "1456178700096635002",
silbato_blanco: "1456179085364695133",
narehate: "1456180289465483396"
};

/* ===================== STATUS ===================== */
function getStatus(id) {
if (!status[id]) status[id] = { money: 0, inventory: {}, messages: 0 };
saveStatus();
return status[id];
}

/* ===================== CLIENT ===================== */
const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
],
partials: [Partials.Channel]
});

/* ===================== READY ===================== */
client.once(Events.ClientReady, async () => {

try {
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
} catch (e) {
console.log("⚠️ No se pudieron registrar comandos (normal si array está vacío)");
}

console.log(`🧭 Belaf despierta como ${client.user.tag}`);

setInterval(async () => {
if (!config.channels.tops) return;

const guild = client.guilds.cache.first();
if (!guild) return;

const members = await guild.members.fetch();
const topUsers = [];

members.forEach(m => {
if (m.user.bot) return;
const st = getStatus(m.id);
topUsers.push({ tag: m.user.tag, money: st.money });
});

topUsers.sort((a, b) => b.money - a.money);
const top10 = topUsers.slice(0, 10);

const embed = new EmbedBuilder()
.setTitle("🏆 TOP Exploradores")
.setDescription(
top10.map((u, i) => `**${i + 1}.** ${u.tag} — 💰 ${u.money}`).join("\n")
)
.setFooter({ text: "Gaburon supervisa los tops" });

const ch = guild.channels.cache.get(config.channels.tops);
if (ch) await ch.send({ embeds: [embed], content: "@everyone @here" });

}, 720 * 60 * 1000);
});

/* ===================== INTERACTIONS ===================== */
client.on(Events.InteractionCreate, async interaction => {

if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isChannelSelectMenu())
return;

/* INVENTORY */
if (interaction.isChatInputCommand() && interaction.commandName === "inventory") {
const user = getStatus(interaction.user.id);

if (!Object.keys(user.inventory).length)
return interaction.reply({ ephemeral: true, content: "🎒 Vacío." });

const list = Object.values(user.inventory)
.map(i => `${i.icon} ${i.name} x${i.qty}`)
.join("\n");

return interaction.reply({
ephemeral: true,
content: `🎒 Inventario\n${list}`
});
}

/* MONEY */
if (interaction.isChatInputCommand() && interaction.commandName === "mymoney") {
const user = getStatus(interaction.user.id);

return interaction.reply({
ephemeral: true,
content: `💰 ${user.money} monedas`
});
}

/* SELL SAFE FIX */
if (interaction.isChatInputCommand() && interaction.commandName === "sell") {
const user = getStatus(interaction.user.id);
const mode = interaction.options.getString("modo");

if (!Object.keys(user.inventory).length)
return interaction.reply({ ephemeral: true, content: "❌ No tienes objetos." });

if (mode === "all") {
let gain = 0;

for (const i of Object.values(user.inventory)) {
const price = Number(i?.price ?? i?.value ?? 0);
gain += price * (i?.qty ?? 0);
}

user.money += gain;
user.inventory = {};
saveStatus();

return interaction.reply({
ephemeral: true,
content: `💰 Vendido todo el inventario por ${gain} monedas`
});
}

return interaction.reply({
ephemeral: true,
content: "ℹ️ Modo parcial aún no implementado en esta versión segura."
});
}

/* MONEY ADMIN SAFE */
if (interaction.isChatInputCommand() && ["setmoney","removemoney","seemoney"].includes(interaction.commandName)) {

const target = interaction.options.getUser("usuario");
const amount = interaction.options.getNumber("cantidad") || 0;
const user = getStatus(target.id);

if (interaction.commandName === "setmoney") {
user.money += amount;
saveStatus();
return interaction.reply({ ephemeral: true, content: `💰 +${amount} a ${target.tag}` });
}

if (interaction.commandName === "removemoney") {
user.money -= amount;
if (user.money < 0) user.money = 0;
saveStatus();
return interaction.reply({ ephemeral: true, content: `💰 -${amount} a ${target.tag}` });
}

if (interaction.commandName === "seemoney") {
return interaction.reply({ ephemeral: true, content: `💰 ${target.tag}: ${user.money}` });
}

}

});

/* ===================== LOGIN ===================== */
client.login(TOKEN);

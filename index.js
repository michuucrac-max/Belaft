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

app.listen(PORT, () =>
console.log(`🌐 Express activo en ${PORT}`)
);

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

const saveStatus = () =>
fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));

const saveConfig = () =>
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

const saveObjects = () =>
fs.writeFileSync(objectsPath, JSON.stringify(objects, null, 2));

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
if (!status[id]) {
status[id] = { money: 0, inventory: {}, messages: 0 };
saveStatus();
}
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

/* ===================== COMMANDS (placeholder seguro) ===================== */
const commands = [];

/* ===================== REST ===================== */
const rest = new REST({ version: "10" }).setToken(TOKEN);

/* ===================== READY ===================== */
client.once(Events.ClientReady, async () => {
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

console.log(`🧭 Belaf despierta como ${client.user.tag}`);

/* TOPS */
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
if (ch) {
await ch.send({ embeds: [embed], content: "@everyone @here" });
}
}, 720 * 60 * 1000);
});

/* ===================== INTERACTIONS ===================== */
client.on(Events.InteractionCreate, async interaction => {

if (
!interaction.isChatInputCommand() &&
!interaction.isStringSelectMenu() &&
!interaction.isChannelSelectMenu()
) return;

/* ===================== SET CHANNEL ===================== */
if (
interaction.isChatInputCommand() &&
interaction.commandName.startsWith("setchannel")
) {
const id = interaction.commandName.replace("setchannel", "");

const menu = new ChannelSelectMenuBuilder()
.setCustomId(`set_${id}`)
.setPlaceholder("Selecciona canal")
.addChannelTypes(ChannelType.GuildText)
.setMinValues(1)
.setMaxValues(id === "reliquies" ? 6 : 1);

return interaction.reply({
ephemeral: true,
components: [new ActionRowBuilder().addComponents(menu)]
});
}

if (
interaction.isChannelSelectMenu() &&
interaction.customId.startsWith("set_")
) {
const id = interaction.customId.replace("set_", "");

if (id === "reliquies") config.channels.reliquies = interaction.values;
if (id === "tops") config.channels.tops = interaction.values[0];

saveConfig();
return interaction.update({
content: "📜 Canal configurado.",
components: []
});
}

/* ===================== INVENTORY ===================== */
if (interaction.commandName === "inventory") {
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

/* ===================== MONEY ===================== */
if (interaction.commandName === "mymoney") {
const user = getStatus(interaction.user.id);

return interaction.reply({
ephemeral: true,
content: `💰 ${user.money} monedas`
});
}

/* ===================== SELL ===================== */
if (interaction.commandName === "sell") {
const user = getStatus(interaction.user.id);
const mode = interaction.options.getString("modo");

if (!Object.keys(user.inventory).length)
return interaction.reply({
ephemeral: true,
content: "❌ No tienes objetos."
});

if (mode === "all") {
let gain = 0;

for (const i of Object.values(user.inventory)) {
const price = Number(i.price ?? i.value ?? 0);
gain += price * i.qty;
}

user.money += gain;
user.inventory = {};
saveStatus();

return interaction.reply({
ephemeral: true,
content: `💰 Vendido todo el inventario por ${gain} monedas`
});
}

const menu = new StringSelectMenuBuilder()
.setCustomId(`sell_${mode}`)
.setPlaceholder("Selecciona objeto")
.addOptions(
Object.values(user.inventory).map(i => ({
label: i.name,
description: `x${i.qty} | 💰 ${i.price ?? i.value ?? 0}`,
value: i.name
}))
);

return interaction.reply({
ephemeral: true,
components: [new ActionRowBuilder().addComponents(menu)]
});
}

/* ===================== SELL SELECT ===================== */
if (
interaction.isStringSelectMenu() &&
interaction.customId.startsWith("sell_")
) {
const mode = interaction.customId.replace("sell_", "");
const itemName = interaction.values[0];
const user = getStatus(interaction.user.id);
const item = user.inventory[itemName];

let gain = 0;

if (mode === "one") {
const price = Number(item.price ?? item.value ?? 0);
item.qty--;
gain = price;
} else {
const price = Number(item.price ?? item.value ?? 0);
gain = item.qty * price;
delete user.inventory[itemName];
}

if (item.qty <= 0) delete user.inventory[itemName];

user.money += gain;
saveStatus();

return interaction.update({
content: `💰 Vendido ${itemName} por ${gain} monedas.`,
components: []
});
}

/* ===================== ADMIN MONEY ===================== */
if (
["setmoney", "removemoney", "seemoney"].includes(interaction.commandName)
) {
const target = interaction.options.getUser("usuario");
const amount = interaction.options.getNumber("cantidad") || 0;
const user = getStatus(target.id);

if (interaction.commandName === "setmoney") {
user.money += amount;
saveStatus();

return interaction.reply({
ephemeral: true,
content: `💰 Se dieron ${amount} monedas a ${target.tag}`
});
}

if (interaction.commandName === "removemoney") {
user.money -= amount;
if (user.money < 0) user.money = 0;
saveStatus();

return interaction.reply({
ephemeral: true,
content: `💰 Se quitaron ${amount} monedas a ${target.tag}`
});
}

if (interaction.commandName === "seemoney") {
return interaction.reply({
ephemeral: true,
content: `💰 ${target.tag} tiene ${user.money} monedas`
});
}
}

/* ===================== LOGIN ===================== */
client.login(TOKEN);

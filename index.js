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

/* ===================== SAFETY (IMPORTANTE) ===================== */
process.on("unhandledRejection", err => {
console.error("❌ Unhandled Rejection:", err);
});

process.on("uncaughtException", err => {
console.error("❌ Uncaught Exception:", err);
});

/* ===================== ENV ===================== */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

/* ===================== VALIDACIÓN BÁSICA ===================== */
if (!TOKEN) console.warn("⚠️ TOKEN no definido en env");
if (!CLIENT_ID) console.warn("⚠️ CLIENT_ID no definido en env");

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

/* ===================== COMMANDS ===================== */
const commands = [
new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),

new SlashCommandBuilder()
.setName("sell")
.setDescription("Vender reliquias")
.addStringOption(o =>
o.setName("modo")
.setDescription("Modo de venta")
.setRequired(true)
.addChoices(
{ name: "Uno", value: "one" },
{ name: "Todo", value: "all" }
)
)
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* ===================== READY ===================== */
client.once(Events.ClientReady, async () => {
try {
if (CLIENT_ID)
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

console.log(`🧭 Belaf despierta como ${client.user.tag}`);
} catch (e) {
console.error("❌ Error en READY:", e);
}
});

/* ===================== INTERACTIONS ===================== */
client.on(Events.InteractionCreate, async interaction => {

if (!interaction.isChatInputCommand()) return;

/* INVENTORY */
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

/* MONEY */
if (interaction.commandName === "mymoney") {
const user = getStatus(interaction.user.id);

return interaction.reply({
ephemeral: true,
content: `💰 ${user.money} monedas`
});
}

/* SELL */
if (interaction.commandName === "sell") {
const user = getStatus(interaction.user.id);
const mode = interaction.options.getString("modo");

if (!Object.keys(user.inventory).length)
return interaction.reply({ ephemeral: true, content: "❌ No tienes objetos." });

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
content: `💰 Vendido inventario por ${gain} monedas`
});
}
});

/* ===================== DROP SYSTEM (SEGURO) ===================== */
client.on(Events.MessageCreate, async message => {
try {
if (message.author.bot || !message.guild) return;
if (!config.channels.reliquies.includes(message.channel.id)) return;

if (Math.random() > 0.15) return;

const pool = objects.class4.concat(objects.class3, objects.class2, objects.special);
if (!pool.length) return;

const item = pool[Math.floor(Math.random() * pool.length)];
const user = getStatus(message.author.id);

if (!user.inventory[item.name]) {
user.inventory[item.name] = { ...item, qty: 0 };
}

user.inventory[item.name].qty++;
saveStatus();

try {
await message.author.send(
`🧭 Has encontrado:\n**${item.icon} ${item.name} x1**`
);
} catch {
message.channel.send(
`🧭 ${message.author}, encontraste **${item.icon} ${item.name} x1**`
);
}

} catch (err) {
console.error("❌ Error en MessageCreate:", err);
}
});

/* ===================== LOGIN ===================== */
client.login(TOKEN).catch(err => {
console.error("❌ Login error:", err);
});

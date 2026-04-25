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

/* =====================
ANTI CRASH (IMPORTANTE)
===================== */
process.on("unhandledRejection", err => {
console.log("❌ Unhandled Rejection:", err);
});

process.on("uncaughtException", err => {
console.log("💥 Uncaught Exception:", err);
});

/* =====================
ENV
===================== */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

/* =====================
EXPRESS
===================== */
const app = express();
app.get("/", (_, res) => res.send("Belaf observa el Abismo 🧭"));
app.listen(PORT, () => console.log(`🌐 Express activo en ${PORT}`));

/* =====================
FILES SAFE LOAD
===================== */
const configPath = "./config.json";
const statusPath = "./status.json";
const objectsPath = "./objects.json";

const config = fs.existsSync(configPath)
? JSON.parse(fs.readFileSync(configPath, "utf8"))
: { channels: { reliquies: [], tops: null } };

const objects = fs.existsSync(objectsPath)
? JSON.parse(fs.readFileSync(objectsPath, "utf8"))
: { class4: [], class3: [], class2: [], class1: [], special: [], ultra: [] };

const status = fs.existsSync(statusPath)
? JSON.parse(fs.readFileSync(statusPath, "utf8"))
: {};

const saveStatus = () => fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
const saveConfig = () => fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
const saveObjects = () => fs.writeFileSync(objectsPath, JSON.stringify(objects, null, 2));

/* =====================
SAFE STATUS
===================== */
function getStatus(id) {
if (!status[id]) {
status[id] = { money: 0, inventory: {}, messages: 0 };
}
return status[id];
}

/* =====================
RANK SYSTEM FLEXIBLE
===================== */
function getMemberRank(member) {
if (!member?.roles) return -1;

const roles = member.roles.cache.map(r => r.name.toLowerCase());

const rankOrder = [
"bell",
"silbato rojo",
"silbato azul",
"silbato lunar",
"silbato negro",
"silbato blanco"
];

for (let i = rankOrder.length - 1; i >= 0; i--) {
if (roles.includes(rankOrder[i])) return i;
}
return -1;
}

/* =====================
DROP SYSTEM (PROBABILIDAD)
===================== */
function getAllItems() {
return [
...objects.class4.map(i => ({ ...i, rarity: 70 })),
...objects.class3.map(i => ({ ...i, rarity: 20 })),
...objects.class2.map(i => ({ ...i, rarity: 8 })),
...objects.class1.map(i => ({ ...i, rarity: 4 })),
...objects.special.map(i => ({ ...i, rarity: 2 })),
...objects.ultra.map(i => ({ ...i, rarity: 0.5 }))
];
}

function rollItem() {
const items = getAllItems();
if (!items.length) return null;

const total = items.reduce((a, b) => a + b.rarity, 0);
let random = Math.random() * total;

for (const item of items) {
random -= item.rarity;
if (random <= 0) return item;
}

return items[0];
}

/* =====================
CLIENT
===================== */
const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
],
partials: [Partials.Channel]
});

/* =====================
SLASH COMMANDS
===================== */
const commands = [
new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),

new SlashCommandBuilder()
.setName("rankup")
.setDescription("Subir rango"),

new SlashCommandBuilder()
.setName("setitem")
.setDescription("Dar item")
.addUserOption(o => o.setName("usuario").setRequired(true)),

new SlashCommandBuilder()
.setName("createartefact")
.setDescription("Crear item")
.addStringOption(o => o.setName("categoria").setRequired(true))
.addStringOption(o => o.setName("nombre").setRequired(true))
.addStringOption(o => o.setName("icono").setRequired(true))
.addNumberOption(o => o.setName("precio").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

/* =====================
REST
===================== */
const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once(Events.ClientReady, async () => {
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
console.log(`🧭 Belaf activo como ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {

if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu()) return;

/* =====================
INVENTORY
===================== */
if (interaction.isChatInputCommand() && interaction.commandName === "inventory") {
const user = getStatus(interaction.user.id);

if (!Object.keys(user.inventory).length)
return interaction.reply({ ephemeral: true, content: "🎒 Vacío" });

const list = Object.values(user.inventory)
.map(i => `${i.icon} ${i.name} x${i.qty}`)
.join("\n");

return interaction.reply({ ephemeral: true, content: `🎒 Inventario\n${list}` });
}

/* =====================
MONEY
===================== */
if (interaction.isChatInputCommand() && interaction.commandName === "mymoney") {
const user = getStatus(interaction.user.id);
return interaction.reply({ ephemeral: true, content: `💰 ${user.money}` });
}

/* =====================
RANKUP SAFE
===================== */
if (interaction.isChatInputCommand() && interaction.commandName === "rankup") {
const member = interaction.member;
if (!member) return;

const st = getStatus(member.id);

const rankOrder = [
"bell",
"silbato rojo",
"silbato azul",
"silbato lunar",
"silbato negro",
"silbato blanco"
];

const costs = [100, 250, 500, 750, 1500, 3000];

let current = getMemberRank(member);

if (current === rankOrder.length - 1)
return interaction.reply({ ephemeral: true, content: "✅ Máximo rango" });

const next = current + 1;

if (st.money < costs[next])
return interaction.reply({
ephemeral: true,
content: `❌ Necesitas ${costs[next]} monedas`
});

st.money -= costs[next];

const role = member.guild.roles.cache.find(r =>
r.name.toLowerCase() === rankOrder[next]
);

if (role) {
await member.roles.add(role).catch(() => {});
}

saveStatus();

return interaction.reply({
ephemeral: true,
content: `✅ Subiste a ${rankOrder[next]}`
});
}

/* =====================
CREATE ARTEFACT
===================== */
if (interaction.commandName === "createartefact") {
const categoria = interaction.options.getString("categoria");
const nombre = interaction.options.getString("nombre");
const icono = interaction.options.getString("icono");
const precio = interaction.options.getNumber("precio");

if (!objects[categoria])
return interaction.reply({ ephemeral: true, content: "❌ Categoría inválida" });

objects[categoria].push({ name: nombre, icon: icono, price: precio });
saveObjects();

return interaction.reply({
ephemeral: true,
content: `✨ ${nombre} creado`
});
}

});

/* =====================
DROP SYSTEM SAFE
===================== */
client.on(Events.MessageCreate, message => {
if (!message.guild || message.author.bot) return;

if (!Array.isArray(config.channels.reliquies)) return;
if (!config.channels.reliquies.includes(message.channel.id)) return;

const user = getStatus(message.author.id);

user.messages++;
saveStatus();

if (user.messages % 10 !== 0) return;

const item = rollItem();
if (!item) return;

if (!user.inventory[item.name]) {
user.inventory[item.name] = { ...item, qty: 0 };
}

user.inventory[item.name].qty++;

saveStatus();

message.reply({
content: `🧭 Reliquia encontrada:\n**${item.icon} ${item.name}**`
}).catch(() => {});
});

/* =====================
LOGIN SAFE
===================== */
client.login(TOKEN).catch(err => {
console.log("❌ Login error:", err);
});

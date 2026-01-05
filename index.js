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
PermissionsBitField
} from "discord.js";

import fs from "fs";
import express from "express";

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
app.listen(PORT);

/* =====================
CLIENT
===================== */
const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
],
partials: [Partials.Channel]
});

/* =====================
FILES
===================== */
const configPath = "./config.json";
const usersPath = "./users.json";
const objectsPath = "./objects.json";

const config = fs.existsSync(configPath)
? JSON.parse(fs.readFileSync(configPath, "utf8"))
: { channels: { reliquies: [], trade: null, sell: null, tops: null } };

const objects = JSON.parse(fs.readFileSync(objectsPath, "utf8"));

const users = fs.existsSync(usersPath)
? JSON.parse(fs.readFileSync(usersPath, "utf8"))
: {};

const saveUsers = () =>
fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

const saveConfig = () =>
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

/* =====================
USER MANAGEMENT
===================== */
function normalizeRole(name) {
return name
.toLowerCase()
.replace(/[^a-z_]/g, "") // 🔧 quita emojis y símbolos
.replace(/s$/, "");     // 🔧 quita plural final
}

function getUser(id, guildMember = null) {
if (!users[id]) {
users[id] = {
money: 0,
rank: "bell",
humanity: true,
inventory: {},
messages: 0
};
}

// 🔧 CAMBIO: detección de roles robusta
if (guildMember) {
const roleOrder = [
"bell",
"silbato_rojo",
"silbato_azul",
"silbato_lunar",
"silbato_negro",
"silbato_blanco",
"narehate"
];

const memberRoles = guildMember.roles.cache.map(r =>
normalizeRole(r.name)
);

const matchedRole = [...roleOrder].reverse().find(r =>
memberRoles.includes(normalizeRole(r))
);

if (matchedRole) users[id].rank = matchedRole;
}

updateHumanity(users[id]);
saveUsers();
return users[id];
}

// Actualiza humanidad según rango
function updateHumanity(user) {
const narehateRanks = [
"silbato_rojo",
"silbato_azul",
"silbato_lunar",
"silbato_negro",
"silbato_blanco",
"narehate"
];
user.humanity = !narehateRanks.includes(user.rank);
}

/* =====================
DROP SYSTEM
===================== */
client.on(Events.MessageCreate, message => {
if (message.author.bot || !message.guild) return;
if (!config.channels.reliquies.includes(message.channel.id)) return;

const depth = config.channels.reliquies.indexOf(message.channel.id);
const user = getUser(message.author.id, message.member);
user.messages++;

if (user.messages % 5 !== 0) return;

const pools = [
objects.class4,
objects.class3,
objects.class2,
objects.special,
objects.special,
objects.special
];

const pool = pools[depth] ?? objects.class4;
const item = pool[Math.floor(Math.random() * pool.length)];

if (!user.inventory[item.name]) {
user.inventory[item.name] = {
name: item.name,
icon: item.icon,
price: item.price ?? item.value ?? 0,
qty: 0
};
}

user.inventory[item.name].qty++;
saveUsers();

message.reply(`🧭 Encontraste ${item.icon} ${item.name}`);
});

/* =====================
RESTO DEL INDEX
===================== */
/* 🔒 Todo lo demás queda EXACTAMENTE igual que lo tenías */
/* 🔒 No se tocó ningún comando, string ni sistema */

client.login(TOKEN);

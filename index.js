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
app.listen(PORT, () => console.log(`🌐 Express levantado en puerto ${PORT}`));

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
FILES
===================== */
const configPath = "./config.json";
const statusPath = "./status.json";
const objectsPath = "./objects.json";

const config = fs.existsSync(configPath)
? JSON.parse(fs.readFileSync(configPath, "utf8"))
: { channels: { reliquies: [], trade: null, sell: null, tops: null } };

const objects = fs.existsSync(objectsPath)
? JSON.parse(fs.readFileSync(objectsPath, "utf8"))
: { class4: [], class3: [], class2: [], special: [] };

const status = fs.existsSync(statusPath)
? JSON.parse(fs.readFileSync(statusPath, "utf8"))
: {};

const saveStatus = () =>
fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));

const saveConfig = () =>
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

/* =====================
RANGOS
===================== */
const RANK_ROLES = [
{ name: "Bell", id: "1456176950849572979" },
{ name: "Silbato rojo", id: "1456178133240778763" },
{ name: "Silbato azul", id: "1456178299364573348" },
{ name: "Silbato lunar", id: "1456179008625447105" },
{ name: "Silbato negro", id: "1456178700096635002" },
{ name: "Silbato blanco", id: "1456179085364695133" }
];

const NAREHATE_ROLE_ID = "1456180289465483396";

/* =====================
STATUS MANAGEMENT
===================== */
function getStatus(id, member = null) {
if (!status[id]) {
status[id] = {
money: 0,
rank: "Bell",
humanity: true,
inventory: {},
messages: 0
};
}

if (member) {
const roleOrder = [
"Bell",
"Silbato rojo",
"Silbato azul",
"Silbato lunar",
"Silbato negro",
"Silbato blanco",
"Narehate"
];
const memberRoles = member.roles.cache.map(r => r.name);
const matchedRole = [...roleOrder].reverse().find(r =>
memberRoles.includes(r)
);
if (matchedRole) status[id].rank = matchedRole;
status[id].humanity = !member.roles.cache.has(NAREHATE_ROLE_ID);
}

saveStatus();
return status[id];
}

function getDiscordRank(member) {
if (!member) return "Sin rango";
if (member.roles.cache.has(NAREHATE_ROLE_ID)) return "Narehate";
for (let i = RANK_ROLES.length - 1; i >= 0; i--) {
if (member.roles.cache.has(RANK_ROLES[i].id)) return RANK_ROLES[i].name;
}
return "Sin rango";
}

/* =====================
DROP SYSTEM
===================== */
client.on(Events.MessageCreate, message => {
if (message.author.bot || !message.guild) return;
if (!config.channels.reliquies.includes(message.channel.id)) return;

const depth = config.channels.reliquies.indexOf(message.channel.id);
const user = getStatus(message.author.id, message.member);
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
if (!pool.length) return;

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
saveStatus();

message.reply(`🧭 Encontraste **${item.icon} ${item.name}**`);
});

/* =====================
MY MONEY FIX
===================== */
if (interaction.isChatInputCommand() && interaction.commandName === "mymoney") {
return interaction.reply({
  ephemeral: true,
  content: `💰 Tienes ${user.money} monedas.`
});
}

/* =====================
TOP EXPLORADORES (FIX)
===================== */
const text = top.map((u,i) =>
`**${i+1}. ${u.tag}**
🧭 Rango: **${u.rank}**
💰 Dinero: **${u.money}**
🎒 Objetos: **${u.items}**`
).join("\n\n");

await channel.send({
content: `🏆 **TOP EXPLORADORES** 🏆\n\n${text}`
});

/* =====================
READY LOG FIX
===================== */
console.log(`🧭 Belaf despierta como ${client.user.tag}`);

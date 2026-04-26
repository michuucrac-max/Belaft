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

/* ===================== */
process.on("unhandledRejection", console.log);
process.on("uncaughtException", console.log);

/* ===================== ENV */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

/* ===================== EXPRESS */
const app = express();
app.get("/", (_, res) => res.send("Belaf observa el Abismo 🧭"));
app.listen(PORT, () => console.log(`🌐 Express activo en ${PORT}`));

/* ===================== FILES */
const configPath = "./config.json";
const statusPath = "./status.json";
const objectsPath = "./objects.json";

const config = fs.existsSync(configPath)
? JSON.parse(fs.readFileSync(configPath, "utf8"))
: { channel: null, channels: {} };

const objects = fs.existsSync(objectsPath)
? JSON.parse(fs.readFileSync(objectsPath, "utf8"))
: { class4: [], class3: [], class2: [], class1: [], special: [], ultra: [] };

const status = fs.existsSync(statusPath)
? JSON.parse(fs.readFileSync(statusPath, "utf8"))
: {};

const saveStatus = () => fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
const saveConfig = () => fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

function getStatus(id){
if(!status[id]) status[id]={ money:0, inventory:{}, messages:0 };
return status[id];
}

/* ===================== RANKS FLEXIBLES */
const rankOrder = [
"bell",
"silbato rojo",
"silbato azul",
"silbato lunar",
"silbato negro",
"silbato blanco"
];

const rankCosts = [0,2500,50000,750000,1500000,30000000];

function getMemberRank(member){
const roles = member.roles.cache.map(r=>r.name.toLowerCase());
for(let i=rankOrder.length-1;i>=0;i--){
if(roles.includes(rankOrder[i])) return i;
}
return -1;
}

/* ===================== DROP POR PROBABILIDAD */
function rollItem(){

const all = [
...objects.class4.map(i=>({...i, chance:70})),
...objects.class3.map(i=>({...i, chance:20})),
...objects.class2.map(i=>({...i, chance:8})),
...objects.class1.map(i=>({...i, chance:4})),
...objects.special.map(i=>({...i, chance:2})),
...objects.ultra.map(i=>({...i, chance:0.5}))
];

const total = all.reduce((a,b)=>a+b.chance,0);
let rand = Math.random()*total;

for(const item of all){
rand -= item.chance;
if(rand <= 0) return item;
}

return null;
}

/* ===================== CLIENT */
const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
],
partials: [Partials.Channel]
});

/* ===================== COMMANDS (COMPLETOS) */
const commands = [

new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),

new SlashCommandBuilder()
.setName("sell")
.setDescription("Vender reliquias")
.addStringOption(o =>
o.setName("modo").setRequired(true)
.addChoices(
{ name: "Uno", value: "one" },
{ name: "Todo", value: "all" }
)
),

new SlashCommandBuilder().setName("rankup").setDescription("Subir rango"),

/* 💰 ADMIN MONEY (IMPORTANTES) */
new SlashCommandBuilder()
.setName("setmoney")
.setDescription("Dar dinero")
.addUserOption(o=>o.setName("usuario").setRequired(true))
.addNumberOption(o=>o.setName("cantidad").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("removemoney")
.setDescription("Quitar dinero")
.addUserOption(o=>o.setName("usuario").setRequired(true))
.addNumberOption(o=>o.setName("cantidad").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("seemoney")
.setDescription("Ver dinero de alguien")
.addUserOption(o=>o.setName("usuario").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

/* ⚙️ CONFIG */
new SlashCommandBuilder()
.setName("setchannelreliquies")
.setDescription("Canal de drops")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("setchanneltops")
.setDescription("Canal de tops")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("setrankup")
.setDescription("Canal de rankup")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)

];

/* ===================== REGISTER */
const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once(Events.ClientReady, async () => {
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
console.log(`🧭 Belaf listo como ${client.user.tag}`);
});

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {
try {

/* ================= CHAT COMMAND ================= */
if (interaction.isChatInputCommand()) {

const cmd = interaction.commandName;

/* ===== CONFIG CHANNELS ===== */
if (cmd === "setchannelreliquies" || cmd === "setchanneltops" || cmd === "setrankup") {

let key = "";

if (cmd === "setchannelreliquies") key = "reliquies";
if (cmd === "setchanneltops") key = "tops";
if (cmd === "setrankup") key = "rankup";

const menu = new ChannelSelectMenuBuilder()
.setCustomId(`set_${key}`)
.addChannelTypes(ChannelType.GuildText)
.setMinValues(1)
.setMaxValues(1);

return interaction.reply({
ephemeral: true,
components: [new ActionRowBuilder().addComponents(menu)]
});
}

/* ===== DEFER PARA EVITAR "pensando..." ===== */
await interaction.deferReply({ ephemeral: true });

/* ===== INVENTORY ===== */
if (cmd === "inventory") {
const user = getStatus(interaction.user.id);

if (!Object.keys(user.inventory).length)
return interaction.editReply("🎒 Inventario vacío");

const list = Object.values(user.inventory)
.map(i => `${i.icon} ${i.name} x${i.qty}`)
.join("\n");

return interaction.editReply(`🎒 Inventario\n${list}`);
}

/* ===== MONEY ===== */
if (cmd === "mymoney") {
return interaction.editReply(`💰 ${getStatus(interaction.user.id).money}`);
}

/* ===== ADMIN MONEY ===== */
if (cmd === "setmoney") {
const target = interaction.options.getUser("usuario");
const amount = interaction.options.getNumber("cantidad");

const user = getStatus(target.id);
user.money += amount;
saveStatus();

return interaction.editReply(`💰 ${target} recibió ${amount}`);
}

if (cmd === "removemoney") {
const target = interaction.options.getUser("usuario");
const amount = interaction.options.getNumber("cantidad");

const user = getStatus(target.id);
user.money -= amount;
if (user.money < 0) user.money = 0;

saveStatus();

return interaction.editReply(`💸 ${target} perdió ${amount}`);
}

if (cmd === "seemoney") {
const target = interaction.options.getUser("usuario");
const user = getStatus(target.id);

return interaction.editReply(`💰 ${target.tag}: ${user.money}`);
}

/* ===== SELL ===== */
if (cmd === "sell") {

const user = getStatus(interaction.user.id);
const mode = interaction.options.getString("modo");

if (!Object.keys(user.inventory).length)
return interaction.editReply("❌ No tienes objetos");

if (mode === "all") {
let gain = 0;

for (const i of Object.values(user.inventory))
gain += (i.price ?? 0) * i.qty;

user.money += gain;
user.inventory = {};
saveStatus();

return interaction.editReply(`💰 Vendiste todo por ${gain}`);
}

const menu = new StringSelectMenuBuilder()
.setCustomId(`sell_${mode}`)
.addOptions(Object.values(user.inventory).map(i => ({
label: i.name,
value: i.name,
description: `x${i.qty}`
})));

return interaction.editReply({
content: "Selecciona objeto",
components: [new ActionRowBuilder().addComponents(menu)]
});
}

/* ===== RANKUP ===== */
if (cmd === "rankup") {

const member = interaction.member;
const st = getStatus(member.id);

let current = getMemberRank(member);

if (current === rankOrder.length - 1)
return interaction.editReply("🏆 Ya tienes el máximo rango");

const next = current + 1;

if (st.money < rankCosts[next])
return interaction.editReply(`❌ Necesitas ${rankCosts[next]} monedas`);

st.money -= rankCosts[next];

const role = member.guild.roles.cache.find(r =>
r.name.toLowerCase() === rankOrder[next]
);

if (role) await member.roles.add(role).catch(()=>{});

saveStatus();

/* ===== MENSAJE BONITO ===== */
if (config.channels?.rankup) {

const ch = member.guild.channels.cache.get(config.channels.rankup);

if (ch) {
const embed = {
color: 0xf1c40f,
title: "🎖️ ¡ASCENSO!",
description: `${member} subió a **${rankOrder[next]}**`,
thumbnail: {
url: member.user.displayAvatarURL({ dynamic: true })
},
timestamp: new Date()
};

ch.send({ content: `${member}`, embeds: [embed] });
}
}

return interaction.editReply(`🎖️ Subiste a ${rankOrder[next]}`);
}

return interaction.editReply("⚠️ Comando no reconocido");
}

/* ================= CHANNEL SELECT ================= */
if (interaction.isChannelSelectMenu()) {

const id = interaction.customId.replace("set_", "");

if (id === "reliquies") config.channel = interaction.values[0];

if (id === "tops") {
config.channels = config.channels || {};
config.channels.tops = interaction.values[0];
}

if (id === "rankup") {
config.channels = config.channels || {};
config.channels.rankup = interaction.values[0];
}

saveConfig();

return interaction.update({
content: "✅ Configuración guardada",
components: []
});
}

/* ================= SELL MENU ================= */
if (interaction.isStringSelectMenu()) {

if (!interaction.customId.startsWith("sell_")) return;

const mode = interaction.customId.replace("sell_", "");
const user = getStatus(interaction.user.id);
const itemName = interaction.values[0];
const item = user.inventory[itemName];

if (!item)
return interaction.update({ content: "❌ Error", components: [] });

let gain = 0;
const price = Number(item.price ?? 0);

if (mode === "one") {
item.qty--;
gain = price;
} else {
gain = item.qty * price;
delete user.inventory[itemName];
}

if (item.qty <= 0) delete user.inventory[itemName];

user.money += gain;
saveStatus();

return interaction.update({
content: `💰 Vendido ${itemName} por ${gain}`,
components: []
});
}

} catch (err) {
console.log(err);

if (interaction.deferred || interaction.replied)
return interaction.editReply("❌ Error");

return interaction.reply({ content: "❌ Error", ephemeral: true });
}
});

/* =====================
DROP SYSTEM (PROB + DM)
===================== */
client.on(Events.MessageCreate, async message => {

if (message.author.bot || !message.guild) return;
if (!config.channel) return;
if (message.channel.id !== config.channel) return;

/* 10% probabilidad */
if (Math.random() > 0.10) return;

const user = getStatus(message.author.id);
const item = rollItem();

if (!item) return;

if (!user.inventory[item.name])
user.inventory[item.name] = { ...item, qty: 0 };

user.inventory[item.name].qty++;
saveStatus();

try {
await message.author.send(`🧭 Encontraste:\n${item.icon} ${item.name}`);
} catch {
message.reply("📩 Activa tus DMs para recibir reliquias");
}

});

/* =====================
TOPS AUTOMÁTICOS (6H)
===================== */
setInterval(async () => {

if (!config.channels?.tops) return;

const guild = client.guilds.cache.first();
if (!guild) return;

const members = await guild.members.fetch();

const ranking = [];

members.forEach(m => {
if (m.user.bot) return;
const st = getStatus(m.id);
ranking.push({ tag: m.user.tag, money: st.money });
});

ranking.sort((a, b) => b.money - a.money);

const desc = ranking.slice(0, 10).map((u, i) => {
const medal = ["🥇","🥈","🥉"][i] || "🔹";
return `${medal} ${u.tag} — 💰 ${u.money}`;
}).join("\n");

const embed = {
title: "🏆 TOP EXPLORADORES",
description: desc,
color: 0x2b2d31
};

const ch = guild.channels.cache.get(config.channels.tops);
if (ch) ch.send({ content: "@everyone @here", embeds: [embed] });

}, 6 * 60 * 60 * 1000);

/* =====================
LOGIN
===================== */
client.login(TOKEN);

import {
Client,
GatewayIntentBits,
Partials,
Events,
REST,
Routes,
SlashCommandBuilder,
ActionRowBuilder,
ChannelSelectMenuBuilder,
ChannelType,
PermissionsBitField,
EmbedBuilder
} from "discord.js";
import fs from "fs";
import express from "express";

/* =====================
ENV
===================== */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

if (!TOKEN || !CLIENT_ID) {
console.error("❌ Faltan variables de entorno");
process.exit(1);
}

/* =====================
EXPRESS
===================== */
const app = express();
app.get("/", (_, res) => res.send("Belaf observa el Abismo 🧭"));
app.listen(PORT, () => console.log(`🌐 Express activo en ${PORT}`));

/* =====================
FILES
===================== */
const configPath = "./config.json";
const statusPath = "./status.json";
const objectsPath = "./objects.json";

/* CONFIG COMPLETA */
const config = fs.existsSync(configPath)
? JSON.parse(fs.readFileSync(configPath))
: {
channels: {
reliquies: null,
tops: null,
rankup: null
}
};

const status = fs.existsSync(statusPath)
? JSON.parse(fs.readFileSync(statusPath))
: {};

const objects = fs.existsSync(objectsPath)
? JSON.parse(fs.readFileSync(objectsPath))
: {
class4: [],
class3: [],
class2: [],
class1: [],
special: [],
ultra: []
};

const saveStatus = () => fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
const saveConfig = () => fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

/* =====================
STATUS
===================== */
function getStatus(id) {
if (!status[id]) status[id] = { money: 0, inventory: {}, lastDrop: 0 };
return status[id];
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
UTILS
===================== */
function normalize(str) {
return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/* =====================
COMANDOS (12 EXACTOS)
===================== */
const commands = [

/* USER */
new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
new SlashCommandBuilder().setName("mymoney").setDescription("Ver dinero"),
new SlashCommandBuilder()
.setName("sell")
.setDescription("Vender objetos")
.addStringOption(o =>
o.setName("modo").setRequired(true)
.addChoices({ name: "Uno", value: "one" }, { name: "Todo", value: "all" })
),
new SlashCommandBuilder().setName("rankup").setDescription("Subir rango"),

/* ADMIN */
new SlashCommandBuilder()
.setName("setmoney")
.addUserOption(o=>o.setName("usuario").setRequired(true))
.addNumberOption(o=>o.setName("cantidad").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("removemoney")
.addUserOption(o=>o.setName("usuario").setRequired(true))
.addNumberOption(o=>o.setName("cantidad").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("seemoney")
.addUserOption(o=>o.setName("usuario").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

/* CONFIG */
new SlashCommandBuilder().setName("setchannelreliquies")
.setDescription("Configurar canal de drops")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder().setName("setchanneltops")
.setDescription("Configurar canal de tops")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder().setName("setchannelrankup")
.setDescription("Configurar canal de rankup")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

/* OBJETOS */
new SlashCommandBuilder()
.setName("setitem")
.addUserOption(o=>o.setName("usuario").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("removeitem")
.addUserOption(o=>o.setName("usuario").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)

];

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* =====================
READY
===================== */
client.once(Events.ClientReady, async () => {
console.log(`🧭 Bot listo como ${client.user.tag}`);

/* REGISTRO LIMPIO */
await rest.put(
Routes.applicationCommands(CLIENT_ID),
{ body: commands }
);

console.log("✅ Comandos registrados");

/* =====================
TOP + TIPS CADA 6H
===================== */
setInterval(async () => {

const guild = client.guilds.cache.first();
if (!guild) return;

/* ===== TOP ===== */
if (config.channels.tops) {
try {
const members = await guild.members.fetch();
const arr = [];

members.forEach(m=>{
if(m.user.bot) return;
const st = getStatus(m.id);
arr.push({ tag: m.user.tag, money: st.money });
});

arr.sort((a,b)=>b.money-a.money);

const medals = ["🥇","🥈","🥉"];

const desc = arr.slice(0,10)
.map((u,i)=>`${medals[i]||`#${i+1}`} ${u.tag} — 💰 ${u.money}`)
.join("\n");

/* EMBED BANNER */
const embed = new EmbedBuilder()
.setColor(0x2b2d31)
.setTitle("🏆 TOP EXPLORADORES")
.setDescription(desc)
.setFooter({ text: "El Abismo observa..." });

const ch = guild.channels.cache.get(config.channels.tops);
if (ch) {
await ch.send({
content: "@everyone",
embeds: [embed]
});
}
} catch {}
}

/* ===== TIPS ===== */
if (config.channels.tops) {

const tips = [
"💡 Vende objetos raros estratégicamente",
"💡 Guarda dinero para rangos altos",
"💡 Los drops épicos son muy raros",
"💡 El spam no aumenta tus probabilidades",
"💡 Mejora tu rango para presumir",
"💡 El Abismo siempre recompensa..."
];

const tip = tips[Math.floor(Math.random()*tips.length)];

const embedTip = new EmbedBuilder()
.setColor(0x5865f2)
.setTitle("📢 CONSEJO DEL ABISMO")
.setDescription(tip);

const ch = guild.channels.cache.get(config.channels.tops);
if (ch) {
await ch.send({ embeds:[embedTip] });
}

}

}, 6 * 60 * 60 * 1000);

});

/* =====================
ERROR HANDLER
===================== */
process.on("unhandledRejection", err => console.error("❌", err));
process.on("uncaughtException", err => console.error("❌", err));

/* =====================
UTIL RANGO
===================== */
function getUserRank(member) {
const roles = member.roles.cache.map(r => normalize(r.name));

const order = [
"bell",
"silbato rojo",
"silbato azul",
"silbato lunar",
"silbato negro",
"silbato blanco"
];

for (let i = order.length - 1; i >= 0; i--) {
if (roles.some(r => r.includes(order[i]))) return i;
}
return -1;
}

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {
try {

if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isChannelSelectMenu()) return;

/* ===== SET CHANNEL ===== */
if (interaction.isChatInputCommand() && interaction.commandName.startsWith("setchannel")) {

const id = interaction.commandName.replace("setchannel","");

const menu = new ChannelSelectMenuBuilder()
.setCustomId(`set_${id}`)
.addChannelTypes(ChannelType.GuildText)
.setMinValues(1)
.setMaxValues(1);

return interaction.reply({
ephemeral: true,
components: [new ActionRowBuilder().addComponents(menu)]
});
}

if (interaction.isChannelSelectMenu() && interaction.customId.startsWith("set_")) {
const id = interaction.customId.replace("set_","");
config.channels[id] = interaction.values[0];
saveConfig();

return interaction.update({
content: "✅ Canal configurado",
components: []
});
}

/* ===== INVENTORY ===== */
if (interaction.commandName === "inventory") {
const user = getStatus(interaction.user.id);

if (!Object.keys(user.inventory).length)
return interaction.reply({ ephemeral:true, content:"🎒 Inventario vacío" });

const list = Object.values(user.inventory)
.map(i => `${i.icon} ${i.name} x${i.qty}`)
.join("\n");

return interaction.reply({
ephemeral:true,
content:`🎒 INVENTARIO\n${list}`
});
}

/* ===== MONEY ===== */
if (interaction.commandName === "mymoney") {
const user = getStatus(interaction.user.id);
return interaction.reply({
ephemeral:true,
content:`💰 ${user.money} monedas`
});
}

/* ===== SELL ===== */
if (interaction.commandName === "sell") {
const user = getStatus(interaction.user.id);
const mode = interaction.options.getString("modo");

if (!Object.keys(user.inventory).length)
return interaction.reply({ ephemeral:true, content:"❌ No tienes objetos" });

if (mode === "all") {
let gain = 0;

for (const i of Object.values(user.inventory)) {
gain += (i.price ?? 0) * i.qty;
}

user.money += gain;
user.inventory = {};
saveStatus();

return interaction.reply({
ephemeral:true,
content:`💰 Vendiste todo por ${gain} monedas`
});
}

/* menú para vender uno */
const menu = new StringSelectMenuBuilder()
.setCustomId("sell_one")
.setPlaceholder("Selecciona objeto")
.addOptions(
Object.values(user.inventory).map(i => ({
label: i.name,
value: i.name,
description: `x${i.qty} | 💰 ${i.price ?? 0}`
}))
);

return interaction.reply({
ephemeral:true,
components:[new ActionRowBuilder().addComponents(menu)]
});
}

/* ===== SELECT SELL ===== */
if (interaction.isStringSelectMenu() && interaction.customId === "sell_one") {

const user = getStatus(interaction.user.id);
const itemName = interaction.values[0];
const item = user.inventory[itemName];

if (!item)
return interaction.update({ content:"❌ Error", components:[] });

const gain = item.price ?? 0;

item.qty--;
if (item.qty <= 0) delete user.inventory[itemName];

user.money += gain;
saveStatus();

return interaction.update({
content:`💰 Vendiste ${itemName} por ${gain}`,
components:[]
});
}

/* ===== ADMIN MONEY ===== */
if (["setmoney","removemoney","seemoney"].includes(interaction.commandName)) {

const target = interaction.options.getUser("usuario");
const amount = interaction.options.getNumber("cantidad") || 0;
const user = getStatus(target.id);

if (interaction.commandName === "setmoney") {
user.money += amount;
saveStatus();
}

if (interaction.commandName === "removemoney") {
user.money = Math.max(0, user.money - amount);
saveStatus();
}

return interaction.reply({
ephemeral:true,
content:`💰 ${target.tag}: ${user.money}`
});
}

/* ===== SET ITEM ===== */
if (interaction.commandName === "setitem") {

const target = interaction.options.getUser("usuario");

const allItems = [
...objects.class4,
...objects.class3,
...objects.class2,
...objects.class1,
...objects.special,
...objects.ultra
];

const menu = new StringSelectMenuBuilder()
.setCustomId(`setitem_${target.id}`)
.setPlaceholder("Selecciona artefacto")
.addOptions(allItems.map(o => ({
label: o.name,
value: o.name,
description: `💰 ${o.price ?? 0}`
})));

return interaction.reply({
ephemeral:true,
components:[new ActionRowBuilder().addComponents(menu)]
});
}

/* SELECT SETITEM */
if (interaction.isStringSelectMenu() && interaction.customId.startsWith("setitem_")) {

const targetId = interaction.customId.replace("setitem_","");
const user = getStatus(targetId);
const itemName = interaction.values[0];

const obj = [
...objects.class4,
...objects.class3,
...objects.class2,
...objects.class1,
...objects.special,
...objects.ultra
].find(o => o.name === itemName);

if (!obj)
return interaction.update({ content:"❌ Error", components:[] });

if (!user.inventory[itemName])
user.inventory[itemName] = { ...obj, qty: 0 };

user.inventory[itemName].qty++;
saveStatus();

return interaction.update({
content:`✅ ${itemName} agregado`,
components:[]
});
}

/* ===== REMOVE ITEM ===== */
if (interaction.commandName === "removeitem") {

const target = interaction.options.getUser("usuario");
const user = getStatus(target.id);

if (!Object.keys(user.inventory).length)
return interaction.reply({ ephemeral:true, content:"❌ Sin objetos" });

const menu = new StringSelectMenuBuilder()
.setCustomId(`removeitem_${target.id}`)
.setPlaceholder("Selecciona objeto")
.addOptions(
Object.values(user.inventory).map(i => ({
label: i.name,
value: i.name,
description: `x${i.qty}`
}))
);

return interaction.reply({
ephemeral:true,
components:[new ActionRowBuilder().addComponents(menu)]
});
}

/* SELECT REMOVE */
if (interaction.isStringSelectMenu() && interaction.customId.startsWith("removeitem_")) {

const targetId = interaction.customId.replace("removeitem_","");
const user = getStatus(targetId);
const itemName = interaction.values[0];

delete user.inventory[itemName];
saveStatus();

return interaction.update({
content:`🗑️ ${itemName} eliminado`,
components:[]
});
}

/* ===== RANKUP ===== */
if (interaction.commandName === "rankup") {

const member = interaction.member;
const st = getStatus(member.id);

const order = [
"bell",
"silbato rojo",
"silbato azul",
"silbato lunar",
"silbato negro",
"silbato blanco"
];

const costs = [0,2500,50000,750000,1500000,30000000];

const current = getUserRank(member);

if (current === order.length - 1)
return interaction.reply({ ephemeral:true, content:"🏁 Ya tienes el rango máximo" });

const next = order[current + 1];
const cost = costs[current + 1];

if (st.money < cost)
return interaction.reply({ ephemeral:true, content:`❌ Necesitas ${cost} monedas` });

const role = member.guild.roles.cache.find(r => normalize(r.name).includes(next));
if (!role)
return interaction.reply({ ephemeral:true, content:"❌ Rol no encontrado" });

try {
await member.roles.add(role);
} catch {
return interaction.reply({ ephemeral:true, content:"❌ Sin permisos para dar rol" });
}

/* quitar roles anteriores */
member.roles.cache.forEach(r=>{
if(order.some(o=>normalize(r.name).includes(o)) && r.id !== role.id){
member.roles.remove(r).catch(()=>{});
}
});

st.money -= cost;
saveStatus();

/* EMBED ASCENSO */
if(config.channels.rankup){
const ch = member.guild.channels.cache.get(config.channels.rankup);
if(ch){
const embed = new EmbedBuilder()
.setColor(0xf1c40f)
.setTitle("✨ ASCENSO")
.setDescription(`${member} ha ascendido a **${role.name}**`)
.setThumbnail(member.user.displayAvatarURL());

ch.send({ embeds:[embed] }).catch(()=>{});
}
}

return interaction.reply({
ephemeral:true,
content:`✨ Ahora eres ${role.name}`
});
}

} catch (err) {
console.error("❌ Error interacción:", err);
}
});

/* =====================
DROPS POR PROBABILIDAD
===================== */
client.on(Events.MessageCreate, async message => {
try {

if (message.author.bot || !message.guild) return;
if (!config.channels.reliquies) return;
if (message.channel.id !== config.channels.reliquies) return;

const user = getStatus(message.author.id);

/* COOLDOWN */
if (Date.now() - user.lastDrop < 4000) return;
user.lastDrop = Date.now();

/* PROBABILIDAD */
if (Math.random() > 0.10) return;

/* CLASES */
const r = Math.random();
let pool;

if (r < 0.5) pool = objects.class4;
else if (r < 0.75) pool = objects.class3;
else if (r < 0.9) pool = objects.class2;
else if (r < 0.97) pool = objects.class1;
else if (r < 0.995) pool = objects.special;
else pool = objects.ultra;

if (!pool.length) return;

const item = pool[Math.floor(Math.random() * pool.length)];

if (!user.inventory[item.name])
user.inventory[item.name] = { ...item, qty: 0 };

user.inventory[item.name].qty++;
saveStatus();

/* DM */
try {
await message.author.send(`🧭 Encontraste ${item.icon} ${item.name}`);
} catch {
message.channel.send(`⚠️ ${message.author}, abre tus DMs`).catch(()=>{});
}

} catch (err) {
console.error("❌ Error drop:", err);
}
});

/* =====================
LOGIN
===================== */
client.login(TOKEN);

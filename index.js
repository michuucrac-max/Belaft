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
ENV VALIDATION
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

const config = fs.existsSync(configPath)
? JSON.parse(fs.readFileSync(configPath))
: { channels: { reliquies: null, tops: null, rankup: null } };

const objects = fs.existsSync(objectsPath)
? JSON.parse(fs.readFileSync(objectsPath))
: { class4: [], class3: [], class2: [], class1: [], special: [], ultra: [] };

const status = fs.existsSync(statusPath)
? JSON.parse(fs.readFileSync(statusPath))
: {};

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

function getUserRank(member) {
const roles = member.roles.cache.map(r => normalize(r.name));
const order = ["bell","silbato rojo","silbato azul","silbato lunar","silbato negro","silbato blanco"];

for (let i = order.length - 1; i >= 0; i--) {
if (roles.some(r => r.includes(order[i]))) return i;
}
return -1;
}

/* =====================
COMMANDS
===================== */
const commands = [

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

new SlashCommandBuilder().setName("setchannelreliquies").setDescription("Canal drops")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder().setName("setchanneltops").setDescription("Canal tops")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder().setName("setchannelrankup").setDescription("Canal rankup")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

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
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
console.log(`🧭 Bot listo como ${client.user.tag}`);

/* TOPS */
setInterval(async () => {
if (!config.channels.tops) return;

const guild = client.guilds.cache.first();
if (!guild) return;

let members;
try {
members = await guild.members.fetch();
} catch (e) {
console.log("Error obteniendo miembros:", e.message);
return;
}

const arr = [];
members.forEach(m => {
if (m.user.bot) return;
const st = getStatus(m.id);
arr.push({ tag: m.user.tag, money: st.money });
});

arr.sort((a,b)=>b.money-a.money);

const medals = ["🥇","🥈","🥉"];
const desc = arr.slice(0,10).map((u,i)=>`${medals[i]||`#${i+1}`} ${u.tag} — 💰 ${u.money}`).join("\n");

const embed = new EmbedBuilder().setTitle("🏆 TOP Exploradores").setDescription(desc);

const ch = guild.channels.cache.get(config.channels.tops);
if (ch) {
try { await ch.send({ content:"@everyone", embeds:[embed] }); }
catch(e){ console.log("Error enviando tops:", e.message); }
}

}, 6 * 60 * 60 * 1000);

});

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {
if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isChannelSelectMenu()) return;

/* ===== SET CHANNELS ===== */
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
if (interaction.isChatInputCommand() && interaction.commandName === "inventory") {
const user = getStatus(interaction.user.id);

if (!Object.keys(user.inventory).length) {
return interaction.reply({ ephemeral: true, content: "🎒 Inventario vacío" });
}

const list = Object.values(user.inventory)
.map(i => `${i.icon} ${i.name} x${i.qty}`)
.join("\n");

return interaction.reply({
ephemeral: true,
content: `🎒 Inventario\n${list}`
});
}

/* ===== MONEY ===== */
if (interaction.isChatInputCommand() && interaction.commandName === "mymoney") {
const user = getStatus(interaction.user.id);
return interaction.reply({
ephemeral: true,
content: `💰 ${user.money} monedas`
});
}

/* ===== SELL ===== */
if (interaction.isChatInputCommand() && interaction.commandName === "sell") {
const user = getStatus(interaction.user.id);
const mode = interaction.options.getString("modo");

if (!Object.keys(user.inventory).length) {
return interaction.reply({ ephemeral: true, content: "❌ No tienes objetos" });
}

if (mode === "all") {
let gain = 0;

for (const i of Object.values(user.inventory)) {
gain += (i.price ?? 0) * i.qty;
}

user.money += gain;
user.inventory = {};
saveStatus();

return interaction.reply({
ephemeral: true,
content: `💰 Vendiste todo por ${gain} monedas`
});
}

/* MENÚ PARA VENDER UNO */
const menu = new StringSelectMenuBuilder()
.setCustomId("sell_one")
.setPlaceholder("Selecciona objeto")
.addOptions(
Object.values(user.inventory).map(i => ({
label: i.name,
description: `x${i.qty} | 💰 ${i.price ?? 0}`,
value: i.name
}))
);

return interaction.reply({
ephemeral: true,
components: [new ActionRowBuilder().addComponents(menu)]
});
}

/* SELECT SELL */
if (interaction.isStringSelectMenu() && interaction.customId === "sell_one") {
const user = getStatus(interaction.user.id);
const itemName = interaction.values[0];
const item = user.inventory[itemName];

if (!item) {
return interaction.update({ content: "❌ Objeto no encontrado", components: [] });
}

const gain = item.price ?? 0;

item.qty--;
if (item.qty <= 0) delete user.inventory[itemName];

user.money += gain;
saveStatus();

return interaction.update({
content: `💰 Vendiste ${itemName} por ${gain}`,
components: []
});
}

/* ===== ADMIN MONEY ===== */
if (interaction.isChatInputCommand() &&
["setmoney","removemoney","seemoney"].includes(interaction.commandName)) {

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
ephemeral: true,
content: `💰 ${target.tag}: ${user.money}`
});
}

/* ===== SET ITEM ===== */
if (interaction.isChatInputCommand() && interaction.commandName === "setitem") {
const target = interaction.options.getUser("usuario");
if (!target) {
return interaction.reply({ ephemeral: true, content: "❌ Usuario no encontrado" });
}

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
.setPlaceholder("Selecciona objeto")
.addOptions(allItems.map(o => ({
label: o.name,
value: o.name,
description: `💰 ${o.price ?? 0}`
})));

return interaction.reply({
ephemeral: true,
components: [new ActionRowBuilder().addComponents(menu)]
});
}

/* SELECT SET ITEM */
if (interaction.isStringSelectMenu() && interaction.customId.startsWith("setitem_")) {
const targetId = interaction.customId.replace("setitem_","");
const target = interaction.guild.members.cache.get(targetId)?.user;

if (!target) {
return interaction.update({ content: "❌ Usuario no encontrado", components: [] });
}

const user = getStatus(target.id);
const itemName = interaction.values[0];

const obj = [
...objects.class4,
...objects.class3,
...objects.class2,
...objects.class1,
...objects.special,
...objects.ultra
].find(o => o.name === itemName);

if (!obj) {
return interaction.update({ content: "❌ Objeto no encontrado", components: [] });
}

if (!user.inventory[itemName]) user.inventory[itemName] = { ...obj, qty: 0 };
user.inventory[itemName].qty++;

saveStatus();

return interaction.update({
content: `✅ ${itemName} agregado a ${target}`,
components: []
});
}

/* ===== REMOVE ITEM ===== */
if (interaction.isChatInputCommand() && interaction.commandName === "removeitem") {
const target = interaction.options.getUser("usuario");
const user = getStatus(target.id);

if (!Object.keys(user.inventory).length) {
return interaction.reply({ ephemeral: true, content: "❌ Sin objetos" });
}

const menu = new StringSelectMenuBuilder()
.setCustomId(`removeitem_${target.id}`)
.setPlaceholder("Selecciona objeto")
.addOptions(Object.values(user.inventory).map(i => ({
label: i.name,
value: i.name,
description: `x${i.qty}`
})));

return interaction.reply({
ephemeral: true,
components: [new ActionRowBuilder().addComponents(menu)]
});
}

/* SELECT REMOVE ITEM */
if (interaction.isStringSelectMenu() && interaction.customId.startsWith("removeitem_")) {
const targetId = interaction.customId.replace("removeitem_","");
const user = getStatus(targetId);
const itemName = interaction.values[0];

if (!user.inventory[itemName]) {
return interaction.update({ content: "❌ No existe", components: [] });
}

delete user.inventory[itemName];
saveStatus();

return interaction.update({
content: `🗑️ ${itemName} eliminado`,
components: []
});
}

/* ===== RANKUP ===== */
if (interaction.isChatInputCommand() && interaction.commandName === "rankup") {
const member = interaction.member;
const st = getStatus(member.id);

const order = ["bell","silbato rojo","silbato azul","silbato lunar","silbato negro","silbato blanco"];
const costs = [100,250,500,750,1500,3000];

const current = getUserRank(member);

if (current === order.length - 1) {
return interaction.reply({ ephemeral: true, content: "✅ Máximo rango" });
}

const next = order[current + 1];
const cost = costs[current + 1];

if (st.money < cost) {
return interaction.reply({ ephemeral: true, content: `❌ Necesitas ${cost}` });
}

const role = member.guild.roles.cache.find(r => normalize(r.name).includes(next));

if (!role) {
return interaction.reply({ ephemeral: true, content: "❌ Rol no encontrado" });
}

try {
await member.roles.add(role);
} catch {
return interaction.reply({ ephemeral: true, content: "❌ Sin permisos para rol" });
}

/* remover otros */
member.roles.cache.forEach(r => {
if (order.some(o => normalize(r.name).includes(o)) && r.id !== role.id) {
member.roles.remove(r).catch(()=>{});
}
});

st.money -= cost;
saveStatus();

/* MENSAJE */
if (config.channels.rankup) {
const ch = member.guild.channels.cache.get(config.channels.rankup);
if (ch) {
try {
const embed = new EmbedBuilder()
.setTitle("✨ ASCENSO")
.setDescription(`${member} ahora es **${role.name}**`)
.setThumbnail(member.user.displayAvatarURL());

await ch.send({ embeds: [embed] });
} catch {}
}
}

return interaction.reply({
ephemeral: true,
content: `✅ Subiste a ${role.name}`
});
}

});

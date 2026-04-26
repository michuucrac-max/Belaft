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
: {
channel: null,
channels: {
tops: null,
rankup: null
}
};

const objects = fs.existsSync(objectsPath)
? JSON.parse(fs.readFileSync(objectsPath, "utf8"))
: { class4: [], class3: [], class2: [], class1: [], special: [], ultra: [] };

const status = fs.existsSync(statusPath)
? JSON.parse(fs.readFileSync(statusPath, "utf8"))
: {};

const saveStatus = () => fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
const saveConfig = () => fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
const saveObjects = () => fs.writeFileSync(objectsPath, JSON.stringify(objects, null, 2));

function getStatus(id){
if(!status[id]) status[id]={ money:0, inventory:{}, messages:0 };
return status[id];
}

/* ===================== RANGOS FLEXIBLES */
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

/* ===================== DROP PROBABILIDAD */
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

/* ===================== COMMANDS (12 EXACTOS) */
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

/* ADMIN MONEY */
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
.setDescription("Ver dinero")
.addUserOption(o=>o.setName("usuario").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

/* ITEMS ADMIN */
new SlashCommandBuilder()
.setName("setitem")
.setDescription("Dar objeto")
.addUserOption(o=>o.setName("usuario").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("removeitem")
.setDescription("Quitar objeto")
.addUserOption(o=>o.setName("usuario").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("createartefact")
.setDescription("Crear objeto")
.addStringOption(o=>o.setName("categoria").setRequired(true))
.addStringOption(o=>o.setName("nombre").setRequired(true))
.addStringOption(o=>o.setName("icono").setRequired(true))
.addNumberOption(o=>o.setName("precio").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

/* CONFIG */
new SlashCommandBuilder()
.setName("setchannelreliquies")
.setDescription("Canal de drops")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("setchanneltops")
.setDescription("Canal de tops")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("setchannelrankup")
.setDescription("Canal de rankup")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)

];

/* ===================== REGISTER GLOBAL */
const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once(Events.ClientReady, async () => {

await rest.put(
Routes.applicationCommands(CLIENT_ID),
{ body: commands.map(c => c.toJSON()) }
);

console.log(`🧭 Belaf activo como ${client.user.tag}`);
});

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {
try {

/* ===================== CHAT COMMAND ===================== */
if (interaction.isChatInputCommand()) {

const cmd = interaction.commandName;

/* ===== SET CHANNELS ===== */
if (cmd === "setchannelreliquies" || cmd === "setchanneltops" || cmd === "setchannelrankup") {

let key = "";

if (cmd === "setchannelreliquies") key = "reliquies";
if (cmd === "setchanneltops") key = "tops";
if (cmd === "setchannelrankup") key = "rankup";

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

/* ===== DEFER ===== */
await interaction.deferReply({ ephemeral: true });

/* ===== INVENTORY ===== */
if (cmd === "inventory") {
const user = getStatus(interaction.user.id);

if (!Object.keys(user.inventory).length)
return interaction.editReply("🎒 Vacío");

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
return interaction.editReply("🏆 Máximo rango");

const next = current + 1;

if (st.money < rankCosts[next])
return interaction.editReply(`❌ Necesitas ${rankCosts[next]}`);

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
const embed = new EmbedBuilder()
.setColor(0xf1c40f)
.setTitle("🎖️ ¡ASCENSO!")
.setDescription(`${member} subió a **${rankOrder[next]}**`)
.setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
.setTimestamp();

ch.send({
content: `${member}`,
embeds: [embed]
});
}
}

return interaction.editReply(`🎖️ Subiste a ${rankOrder[next]}`);
}

/* ===== SET ITEM ===== */
if (cmd === "setitem") {
const target = interaction.options.getUser("usuario");

const menu = new StringSelectMenuBuilder()
.setCustomId(`setitem_${target.id}`)
.addOptions([...objects.class4,...objects.class3,...objects.class2,...objects.class1,...objects.special,...objects.ultra].map(o=>({
label:o.name,
value:o.name
})));

return interaction.editReply({
content: "Selecciona objeto",
components: [new ActionRowBuilder().addComponents(menu)]
});
}

/* ===== REMOVE ITEM ===== */
if (cmd === "removeitem") {
const target = interaction.options.getUser("usuario");

const user = getStatus(target.id);

if (!Object.keys(user.inventory).length)
return interaction.editReply("❌ Vacío");

const menu = new StringSelectMenuBuilder()
.setCustomId(`removeitem_${target.id}`)
.addOptions(Object.keys(user.inventory).map(i=>({
label:i,
value:i
})));

return interaction.editReply({
content: "Selecciona objeto",
components: [new ActionRowBuilder().addComponents(menu)]
});
}

/* ===== CREATE ARTEFACT ===== */
if (cmd === "createartefact") {

const categoria = interaction.options.getString("categoria");
const nombre = interaction.options.getString("nombre");
const icono = interaction.options.getString("icono");
const precio = interaction.options.getNumber("precio");

if(!objects[categoria])
return interaction.editReply("❌ Categoría inválida");

objects[categoria].push({ name:nombre, icon:icono, price:precio });
saveObjects();

return interaction.editReply(`✨ ${nombre} creado`);
}

}

/* ===================== CHANNEL SELECT ===================== */
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

/* ===================== SELECT MENUS ===================== */
if (interaction.isStringSelectMenu()) {

const user = getStatus(interaction.user.id);

/* SELL */
if (interaction.customId.startsWith("sell_")) {

const mode = interaction.customId.replace("sell_", "");
const itemName = interaction.values[0];
const item = user.inventory[itemName];

let gain = 0;

if (mode === "one") {
item.qty--;
gain = item.price ?? 0;
} else {
gain = item.qty * (item.price ?? 0);
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

/* SET ITEM */
if (interaction.customId.startsWith("setitem_")) {

const targetId = interaction.customId.replace("setitem_", "");
const target = getStatus(targetId);
const itemName = interaction.values[0];

const obj = [...objects.class4,...objects.class3,...objects.class2,...objects.class1,...objects.special,...objects.ultra]
.find(o=>o.name === itemName);

if (!target.inventory[itemName])
target.inventory[itemName] = { ...obj, qty: 0 };

target.inventory[itemName].qty++;
saveStatus();

return interaction.update({
content: `✅ ${itemName} dado`,
components: []
});
}

/* REMOVE ITEM */
if (interaction.customId.startsWith("removeitem_")) {

const targetId = interaction.customId.replace("removeitem_", "");
const target = getStatus(targetId);
const itemName = interaction.values[0];

delete target.inventory[itemName];
saveStatus();

return interaction.update({
content: `❌ ${itemName} eliminado`,
components: []
});
}

}

} catch (err) {
console.log(err);

if (interaction.deferred || interaction.replied)
return interaction.editReply("❌ Error");

return interaction.reply({ content: "❌ Error", ephemeral: true });
}
});

/* =====================
DROP SYSTEM (PROBABILIDAD + DM)
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
message.reply("📩 Activa tus DMs");
}

});

/* =====================
TOPS (CADA 6 HORAS)
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

const embed = new EmbedBuilder()
.setTitle("🏆 TOP EXPLORADORES")
.setDescription(desc)
.setColor(0x2b2d31);

const ch = guild.channels.cache.get(config.channels.tops);

if (ch) {
ch.send({
content: "@everyone @here",
embeds: [embed]
});
}

}, 6 * 60 * 60 * 1000);

/* =====================
LOGIN
===================== */
client.login(TOKEN);

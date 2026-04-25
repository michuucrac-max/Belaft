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
ENV
===================== */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

/* =====================
EXPRESS
===================== */
const app = express();
app.get("/", (_, res) => res.send(`Belaf observa el Abismo 🧭`));
app.listen(PORT, () => console.log(`🌐 Express activo en ${PORT}`));

/* =====================
FILES / CONFIG
===================== */
const configPath = "./config.json";
const statusPath = "./status.json";
const objectsPath = "./objects.json";

const config = fs.existsSync(configPath)
? JSON.parse(fs.readFileSync(configPath, "utf8"))
: { channels: { reliquies: null, trade: null, sell: null, tops: null } };

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
RANKS FLEXIBLES
===================== */
const ranks = {
bell: "bell",
silbato_rojo: "silbato rojo",
silbato_azul: "silbato azul",
silbato_lunar: "silbato lunar",
silbato_negro: "silbato negro",
silbato_blanco: "silbato blanco",
narehate: "narehate"
};

function normalize(text) {
return text
.toLowerCase()
.normalize("NFD")
.replace(/[\u0300-\u036f]/g, "")
.replace(/[^\p{L}\p{N}\s]/gu, "")
.trim();
}

function getRoleFlexible(guild, baseName) {
const target = normalize(baseName);
return guild.roles.cache.find(r => normalize(r.name).includes(target));
}

/* =====================
STATUS FUNCTION
===================== */
function getStatus(id) {
if (!status[id]) status[id] = { money: 0, inventory: {}, messages: 0 };
saveStatus();
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
SLASH COMMANDS
===================== */
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
),

new SlashCommandBuilder()
.setName("setchannelreliquies")
.setDescription("Configurar canal de drops")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("setchanneltops")
.setDescription("Configurar canal de tops")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("setmoney")
.setDescription("Dar dinero")
.addUserOption(o => o.setName("usuario").setRequired(true))
.addNumberOption(o => o.setName("cantidad").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("removemoney")
.setDescription("Quitar dinero")
.addUserOption(o => o.setName("usuario").setRequired(true))
.addNumberOption(o => o.setName("cantidad").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("seemoney")
.setDescription("Ver dinero")
.addUserOption(o => o.setName("usuario").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("rankup")
.setDescription("Subir rango")
];

/* =====================
REST
===================== */
const rest = new REST({ version: "10" }).setToken(TOKEN);

/* =====================
READY
===================== */
client.once(Events.ClientReady, async () => {
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
console.log(`🧭 Belaf despierta como ${client.user.tag}`);
});

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {

if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isChannelSelectMenu()) return;

/* SET CHANNEL */
if (interaction.isChatInputCommand() && interaction.commandName.startsWith("setchannel")) {
const id = interaction.commandName.replace("setchannel", "");

const menu = new ChannelSelectMenuBuilder()
.setCustomId(`set_${id}`)
.setPlaceholder("Selecciona canal")
.addChannelTypes(ChannelType.GuildText)
.setMinValues(1)
.setMaxValues(1);

return interaction.reply({
ephemeral: true,
components: [new ActionRowBuilder().addComponents(menu)]
});
}

if (interaction.isChannelSelectMenu() && interaction.customId.startsWith("set_")) {
const id = interaction.customId.replace("set_", "");
config.channels[id] = interaction.values[0];
saveConfig();
return interaction.update({ content: "📜 Canal configurado.", components: [] });
}

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
content: `🎒 **Inventario**\n${list}`
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

/* SELL */
if (interaction.isChatInputCommand() && interaction.commandName === "sell") {
const user = getStatus(interaction.user.id);
const mode = interaction.options.getString("modo");

if (!Object.keys(user.inventory).length)
return interaction.reply({ ephemeral: true, content: "❌ No tienes objetos." });

if (mode === "all") {
let gain = 0;
for (const i of Object.values(user.inventory)) {
gain += (i.price ?? i.value ?? 0) * i.qty;
}
user.money += gain;
user.inventory = {};
saveStatus();
return interaction.reply({ ephemeral: true, content: `💰 Vendido todo por ${gain}` });
}

const menu = new StringSelectMenuBuilder()
.setCustomId(`sell_${mode}`)
.setPlaceholder("Selecciona objeto")
.addOptions(Object.values(user.inventory).map(i => ({
label: i.name,
value: i.name,
description: `x${i.qty} | 💰 ${i.price ?? i.value ?? 0}`
})));

return interaction.reply({
ephemeral: true,
components: [new ActionRowBuilder().addComponents(menu)]
});
}

/* SELL MENU */
if (interaction.isStringSelectMenu() && interaction.customId.startsWith("sell_")) {
const mode = interaction.customId.replace("sell_", "");
const itemName = interaction.values[0];
const user = getStatus(interaction.user.id);
const item = user.inventory[itemName];

let gain = 0;
const price = item.price ?? item.value ?? 0;

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

/* ADMIN MONEY */
if (interaction.isChatInputCommand() && ["setmoney","removemoney","seemoney"].includes(interaction.commandName)) {
const target = interaction.options.getUser("usuario");
const amount = interaction.options.getNumber("cantidad") || 0;
const user = getStatus(target.id);

if (interaction.commandName === "setmoney") {
user.money += amount;
saveStatus();
return interaction.reply({ ephemeral: true, content: `+${amount} a ${target.tag}` });
}

if (interaction.commandName === "removemoney") {
user.money -= amount;
if (user.money < 0) user.money = 0;
saveStatus();
return interaction.reply({ ephemeral: true, content: `-${amount} a ${target.tag}` });
}

if (interaction.commandName === "seemoney") {
return interaction.reply({ ephemeral: true, content: `${target.tag}: ${user.money}` });
}
}

/* RANKUP */
if (interaction.isChatInputCommand() && interaction.commandName === "rankup") {
const member = interaction.member;
const guild = interaction.guild;
const st = getStatus(member.id);

const order = ["bell","silbato_rojo","silbato_azul","silbato_lunar","silbato_negro","silbato_blanco"];
const costs = [100,250,500,750,1500,3000];

let idx = -1;

for (let i = order.length - 1; i >= 0; i--) {
const role = getRoleFlexible(guild, ranks[order[i]]);
if (role && member.roles.cache.has(role.id)) {
idx = i;
break;
}
}

if (idx === order.length - 1)
return interaction.reply({ ephemeral: true, content: "✅ Máximo rango" });

const next = getRoleFlexible(guild, ranks[order[idx + 1]]);
if (!next)
return interaction.reply({ ephemeral: true, content: "❌ Rol no encontrado" });

if (st.money < costs[idx + 1])
return interaction.reply({ ephemeral: true, content: `❌ Necesitas ${costs[idx + 1]}` });

st.money -= costs[idx + 1];
await member.roles.add(next);

saveStatus();

return interaction.reply({
ephemeral: true,
content: `✅ Subiste a ${next.name}`
});
}

});

/* =====================
DROP SYSTEM
===================== */
client.on(Events.MessageCreate, message => {
if (message.author.bot || !message.guild) return;
if (message.channel.id !== config.channels.reliquies) return;

const user = getStatus(message.author.id);
user.messages++;

if (user.messages % 10 !== 0) return;

const chances = [
{ pool: objects.ultra, chance: 1 },
{ pool: objects.special, chance: 5 },
{ pool: objects.class1, chance: 10 },
{ pool: objects.class2, chance: 20 },
{ pool: objects.class3, chance: 30 },
{ pool: objects.class4, chance: 34 }
];

let rand = Math.random() * 100;
let acc = 0;
let selected = objects.class4;

for (const c of chances) {
acc += c.chance;
if (rand <= acc) {
selected = c.pool;
break;
}
}

if (!selected.length) return;

const item = selected[Math.floor(Math.random() * selected.length)];

if (!user.inventory[item.name]) user.inventory[item.name] = { ...item, qty: 0 };
user.inventory[item.name].qty++;

saveStatus();

message.reply({
content: `🧭 ¡Encontraste!\n**${item.icon} ${item.name}** x1`
});
});

/* =====================
LOGIN
===================== */
client.login(TOKEN);

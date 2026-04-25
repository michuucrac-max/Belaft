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
app.get("/", (_, res) => res.send(`Belaf observa el Abismo 🧭`));
app.listen(PORT, () => console.log(`🌐 Express activo en ${PORT}`));

/* ===================== FILES ===================== */
const configPath = "./config.json";
const statusPath = "./status.json";
const objectsPath = "./objects.json";

const config = fs.existsSync(configPath)
? JSON.parse(fs.readFileSync(configPath, "utf8"))
: { channels: { reliquies: null, tops: null } };

const objects = fs.existsSync(objectsPath)
? JSON.parse(fs.readFileSync(objectsPath, "utf8"))
: { class4: [], class3: [], class2: [], class1: [], special: [], ultra: [] };

const status = fs.existsSync(statusPath)
? JSON.parse(fs.readFileSync(statusPath, "utf8"))
: {};

const saveStatus = () => fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
const saveConfig = () => fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
const saveObjects = () => fs.writeFileSync(objectsPath, JSON.stringify(objects, null, 2));

/* ===================== RANKS FLEXIBLES ===================== */
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
return text.toLowerCase()
.normalize("NFD")
.replace(/[\u0300-\u036f]/g, "")
.replace(/[^\p{L}\p{N}\s]/gu, "")
.trim();
}

function getRoleFlexible(guild, name) {
return guild.roles.cache.find(r => normalize(r.name).includes(normalize(name)));
}

/* ===================== STATUS ===================== */
function getStatus(id) {
if (!status[id]) status[id] = { money: 0, inventory: {}, messages: 0 };
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
.setDescription("Configurar canal tops")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("setmoney")
.addUserOption(o => o.setName("usuario").setRequired(true))
.addNumberOption(o => o.setName("cantidad").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("removemoney")
.addUserOption(o => o.setName("usuario").setRequired(true))
.addNumberOption(o => o.setName("cantidad").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("seemoney")
.addUserOption(o => o.setName("usuario").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("rankup")
.setDescription("Subir rango"),

new SlashCommandBuilder()
.setName("createartefact")
.addStringOption(o => o.setName("categoria").setRequired(true))
.addStringOption(o => o.setName("nombre").setRequired(true))
.addStringOption(o => o.setName("icono").setRequired(true))
.addNumberOption(o => o.setName("precio").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* ===================== READY ===================== */
client.once(Events.ClientReady, async () => {
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
console.log(`🧭 Belaf listo como ${client.user.tag}`);
});

/* ===================== INTERACTIONS ===================== */
client.on(Events.InteractionCreate, async interaction => {
try {

if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isChannelSelectMenu()) return;

/* SET CHANNEL */
if (interaction.isChatInputCommand() && interaction.commandName.startsWith("setchannel")) {
const id = interaction.commandName.replace("setchannel", "");

const menu = new ChannelSelectMenuBuilder()
.setCustomId(`set_${id}`)
.addChannelTypes(ChannelType.GuildText);

return interaction.reply({
ephemeral: true,
components: [new ActionRowBuilder().addComponents(menu)]
});
}

if (interaction.isChannelSelectMenu() && interaction.customId.startsWith("set_")) {
const id = interaction.customId.replace("set_", "");
config.channels[id] = interaction.values[0];
saveConfig();
return interaction.update({ content: "📜 Canal configurado", components: [] });
}

/* INVENTORY */
if (interaction.commandName === "inventory") {
const u = getStatus(interaction.user.id);
const items = Object.values(u.inventory);
if (!items.length) return interaction.reply({ ephemeral: true, content: "🎒 Vacío" });

return interaction.reply({
ephemeral: true,
content: items.map(i => `${i.icon} ${i.name} x${i.qty}`).join("\n")
});
}

/* MONEY */
if (interaction.commandName === "mymoney") {
return interaction.reply({
ephemeral: true,
content: `💰 ${getStatus(interaction.user.id).money}`
});
}

/* ADMIN MONEY */
if (["setmoney","removemoney","seemoney"].includes(interaction.commandName)) {
const target = interaction.options.getUser("usuario");
const amount = interaction.options.getNumber("cantidad") || 0;
const user = getStatus(target.id);

if (interaction.commandName === "setmoney") {
user.money += amount;
saveStatus();
return interaction.reply({ ephemeral: true, content: `+${amount}` });
}

if (interaction.commandName === "removemoney") {
user.money -= amount;
if (user.money < 0) user.money = 0;
saveStatus();
return interaction.reply({ ephemeral: true, content: `-${amount}` });
}

if (interaction.commandName === "seemoney") {
return interaction.reply({ ephemeral: true, content: `${user.money}` });
}
}

/* SELL */
if (interaction.commandName === "sell") {
const u = getStatus(interaction.user.id);
const mode = interaction.options.getString("modo");

if (!Object.keys(u.inventory).length)
return interaction.reply({ ephemeral: true, content: "❌ Vacío" });

if (mode === "all") {
let gain = 0;
for (const i of Object.values(u.inventory))
gain += Number(i.price ?? i.value ?? 0) * i.qty;

u.money += gain;
u.inventory = {};
saveStatus();

return interaction.reply({ ephemeral: true, content: `💰 ${gain}` });
}

const menu = new StringSelectMenuBuilder()
.setCustomId(`sell_${mode}`)
.addOptions(Object.values(u.inventory).map(i => ({
label: i.name,
value: i.name
})));

return interaction.reply({
ephemeral: true,
components: [new ActionRowBuilder().addComponents(menu)]
});
}

/* SELL MENU */
if (interaction.isStringSelectMenu() && interaction.customId.startsWith("sell_")) {
const u = getStatus(interaction.user.id);
const name = interaction.values[0];
const item = u.inventory[name];

if (!item) return interaction.update({ content: "❌ Error", components: [] });

const price = Number(item.price ?? item.value ?? 0);
item.qty--;
if (item.qty <= 0) delete u.inventory[name];

u.money += price;
saveStatus();

return interaction.update({ content: `💰 +${price}`, components: [] });
}

/* RANKUP */
if (interaction.commandName === "rankup") {
const member = interaction.member;
const st = getStatus(member.id);

const order = ["bell","silbato_rojo","silbato_azul","silbato_lunar","silbato_negro","silbato_blanco"];
const costs = [100,250,500,750,1500,3000];

let idx = -1;
for (let i = order.length - 1; i >= 0; i--) {
const role = getRoleFlexible(interaction.guild, ranks[order[i]]);
if (role && member.roles.cache.has(role.id)) {
idx = i;
break;
}
}

if (idx === order.length - 1)
return interaction.reply({ ephemeral: true, content: "Max rango" });

const next = getRoleFlexible(interaction.guild, ranks[order[idx + 1]]);
if (!next)
return interaction.reply({ ephemeral: true, content: "Rol no encontrado" });

if (st.money < costs[idx + 1])
return interaction.reply({ ephemeral: true, content: "No tienes dinero" });

st.money -= costs[idx + 1];
await member.roles.add(next);

saveStatus();
return interaction.reply({ ephemeral: true, content: `Subiste a ${next.name}` });
}

/* CREATE ITEM */
if (interaction.commandName === "createartefact") {
const c = interaction.options.getString("categoria");
const n = interaction.options.getString("nombre");
const i = interaction.options.getString("icono");
const p = interaction.options.getNumber("precio");

if (!objects[c]) return interaction.reply({ ephemeral: true, content: "❌ Categoría inválida" });

objects[c].push({ name: n, icon: i, price: p });
saveObjects();

return interaction.reply({ ephemeral: true, content: `Creado ${n}` });
}

} catch (err) {
console.error(err);
interaction.reply({ content: "❌ Error interno", ephemeral: true }).catch(()=>{});
}
});

/* ===================== DROPS POR PROBABILIDAD ===================== */
client.on(Events.MessageCreate, message => {
try {
if (message.author.bot || !message.guild) return;
if (message.channel.id !== config.channels.reliquies) return;

/* SOLO PROBABILIDAD */
if (Math.random() > 0.15) return;

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
const u = getStatus(message.author.id);

if (!u.inventory[item.name]) u.inventory[item.name] = { ...item, qty: 0 };
u.inventory[item.name].qty++;

saveStatus();

message.reply(`🧭 ${item.icon} ${item.name}`);

} catch (e) {
console.error(e);
}
});

/* ===================== ERRORS ===================== */
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);
client.on("error", console.error);

/* ===================== LOGIN ===================== */
client.login(TOKEN);

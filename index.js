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
const GUILD_ID = process.env.GUILD_ID;
const PORT = process.env.PORT || 3000;

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

/* ===================== STATUS ===================== */
function getStatus(id) {
if (!status[id]) status[id] = { money: 0, inventory: {} };
if (!status[id].inventory) status[id].inventory = {};
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

/* ===================== ROLES ===================== */
const ranks = {
bell: "🔔 bell",
rojo: "🔴 silbato rojo",
azul: "🔵 silbato azul",
lunar: "🌙 silbato lunar",
negro: "⚫ silbato negro",
blanco: "⚪ silbato blanco"
};

/* ===================== COMMANDS ===================== */
const commands = [

new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),

new SlashCommandBuilder().setName("mymoney").setDescription("Ver dinero"),

new SlashCommandBuilder()
.setName("sell")
.setDescription("Vender artefactos")
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
.setDescription("Configurar canal drops")
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

await rest.put(
Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
{ body: commands }
);

console.log(`🧭 Belaf listo como ${client.user.tag}`);
});

/* ===================== INTERACTIONS ===================== */
client.on(Events.InteractionCreate, async interaction => {
try {

if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isChannelSelectMenu())
return;

/* ===================== CHANNEL ===================== */
if (interaction.isChatInputCommand() && interaction.commandName === "setchannelreliquies") {

const menu = new ChannelSelectMenuBuilder()
.setCustomId("set_reliquies")
.setPlaceholder("Selecciona canal")
.addChannelTypes(ChannelType.GuildText);

return interaction.reply({
ephemeral: true,
components: [new ActionRowBuilder().addComponents(menu)]
});
}

if (interaction.isChannelSelectMenu() && interaction.customId === "set_reliquies") {
config.channels.reliquies = interaction.values[0];
saveConfig();
return interaction.update({ content: "📜 Canal configurado", components: [] });
}

/* ===================== INVENTORY ===================== */
if (interaction.commandName === "inventory") {
const u = getStatus(interaction.user.id);
const items = Object.values(u.inventory);

if (!items.length)
return interaction.reply({ ephemeral: true, content: "Vacío" });

return interaction.reply({
ephemeral: true,
content: items.map(i => `${i.icon} ${i.name} x${i.qty}`).join("\n")
});
}

/* ===================== MONEY ===================== */
if (interaction.commandName === "mymoney") {
const u = getStatus(interaction.user.id);
return interaction.reply({ ephemeral: true, content: `💰 ${u.money}` });
}

/* ===================== SELL ===================== */
if (interaction.commandName === "sell") {
const u = getStatus(interaction.user.id);
const mode = interaction.options.getString("modo");

if (!Object.keys(u.inventory).length)
return interaction.reply({ ephemeral: true, content: "Vacío" });

if (mode === "all") {
let gain = 0;

for (const i of Object.values(u.inventory))
gain += Number(i.price ?? 0) * i.qty;

u.money += gain;
u.inventory = {};
saveStatus();

return interaction.reply({ ephemeral: true, content: `💰 ${gain}` });
}

const menu = new StringSelectMenuBuilder()
.setCustomId("sell")
.addOptions(Object.values(u.inventory).map(i => ({
label: i.name,
value: i.name
})));

return interaction.reply({
ephemeral: true,
components: [new ActionRowBuilder().addComponents(menu)]
});
}

/* ===================== SELL MENU ===================== */
if (interaction.isStringSelectMenu() && interaction.customId === "sell") {
const u = getStatus(interaction.user.id);
const item = u.inventory[interaction.values[0]];

if (!item) return interaction.update({ content: "Error", components: [] });

const price = Number(item.price ?? 0);

item.qty--;
if (item.qty <= 0) delete u.inventory[item.name];

u.money += price;
saveStatus();

return interaction.update({ content: `💰 +${price}`, components: [] });
}

/* ===================== RANKUP ===================== */
if (interaction.commandName === "rankup") {
const member = interaction.member;
const u = getStatus(member.id);

const roles = ["bell","rojo","azul","lunar","negro","blanco"];
const costs = [100,250,500,750,1500,3000];

let idx = -1;

for (let i = roles.length - 1; i >= 0; i--) {
const role = interaction.guild.roles.cache.find(r =>
r.name.toLowerCase().includes(roles[i])
);
if (role && member.roles.cache.has(role.id)) {
idx = i;
break;
}
}

if (idx >= roles.length - 1)
return interaction.reply({ ephemeral: true, content: "Max rango" });

const nextRole = interaction.guild.roles.cache.find(r =>
r.name.toLowerCase().includes(roles[idx + 1])
);

if (!nextRole)
return interaction.reply({ ephemeral: true, content: "No role" });

if (u.money < costs[idx + 1])
return interaction.reply({ ephemeral: true, content: "No dinero" });

u.money -= costs[idx + 1];
await member.roles.add(nextRole);

saveStatus();

return interaction.reply({ ephemeral: true, content: `Subiste a ${nextRole.name}` });
}

/* ===================== CREATE ITEM ===================== */
if (interaction.commandName === "createartefact") {
const c = interaction.options.getString("categoria");
const n = interaction.options.getString("nombre");
const icon = interaction.options.getString("icono");
const price = interaction.options.getNumber("precio");

if (!objects[c])
return interaction.reply({ ephemeral: true, content: "Categoría inválida" });

objects[c].push({ name: n, icon, price });
saveObjects();

return interaction.reply({ ephemeral: true, content: `Creado ${n}` });
}

} catch (e) {
console.error(e);
}
});

/* ===================== DROPS ===================== */
client.on(Events.MessageCreate, async message => {
if (message.author.bot || !message.guild) return;
if (message.channel.id !== config.channels.reliquies) return;

if (Math.random() > 0.12) return;

const pools = [
objects.ultra,
objects.special,
objects.class1,
objects.class2,
objects.class3,
objects.class4
];

const pool = pools[Math.floor(Math.random() * pools.length)];
if (!pool.length) return;

const item = pool[Math.floor(Math.random() * pool.length)];
const u = getStatus(message.author.id);

if (!u.inventory[item.name]) u.inventory[item.name] = { ...item, qty: 0 };
u.inventory[item.name].qty++;

saveStatus();

try {
await message.author.send(`🧭 ${item.icon} ${item.name}`);
} catch {
message.reply(`🧭 ${item.icon} ${item.name}`);
}
});

/* ===================== ERROR HANDLING ===================== */
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);
client.on("error", console.error);

/* ===================== LOGIN ===================== */
client.login(TOKEN);

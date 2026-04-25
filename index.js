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
ANTI CRASH (AÑADIDO)
===================== */
process.on("unhandledRejection", err => console.log("❌", err));
process.on("uncaughtException", err => console.log("💥", err));

/* =====================
ENV
===================== */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

/* =====================
EXPRESS (FIX STRING)
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
? JSON.parse(fs.readFileSync(configPath, "utf8"))
: { channels: { reliquies: [], trade: null, sell: null, tops: null } };

const objects = fs.existsSync(objectsPath)
? JSON.parse(fs.readFileSync(objectsPath, "utf8"))
: { class4: [], class3: [], class2: [], class1: [], special: [], ultra: [] };

const status = fs.existsSync(statusPath)
? JSON.parse(fs.readFileSync(statusPath, "utf8"))
: {};

const saveStatus = () => fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
const saveConfig = () => fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
const saveObjects = () => fs.writeFileSync(objectsPath, JSON.stringify(objects, null, 2));

function getStatus(id) {
if (!status[id]) status[id] = { money: 0, inventory: {}, messages: 0 };
return status[id];
}

/* =====================
DROP PROBABILIDAD (MEJORA SIN ROMPER)
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
let rand = Math.random() * total;

for (const item of items) {
rand -= item.rarity;
if (rand <= 0) return item;
}
return items[0];
}

const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
],
partials: [Partials.Channel]
});

const commands = [
new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),

new SlashCommandBuilder()
.setName("sell")
.setDescription("Vender reliquias")
.addStringOption(o =>
o.setName("modo")
.setDescription("Modo")
.setRequired(true)
.addChoices(
{ name: "Uno", value: "one" },
{ name: "Todo", value: "all" }
)
),

new SlashCommandBuilder()
.setName("setchannelreliquies")
.setDescription("Configurar drops")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("setchanneltops")
.setDescription("Configurar tops")
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
.setDescription("Subir rango"),

new SlashCommandBuilder()
.setName("setitem")
.setDescription("Dar item")
.addUserOption(o => o.setName("usuario").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("createartefact")
.setDescription("Crear item")
.addStringOption(o => o.setName("categoria").setRequired(true))
.addStringOption(o => o.setName("nombre").setRequired(true))
.addStringOption(o => o.setName("icono").setRequired(true))
.addNumberOption(o => o.setName("precio").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once(Events.ClientReady, async () => {
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
console.log(`🧭 Belaf despierta como ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {

if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isChannelSelectMenu()) return;

try {

/* 🔧 FIX PRINCIPAL */
if (interaction.isChatInputCommand()) {
await interaction.deferReply({ ephemeral: true });
}

const cmd = interaction.commandName;

/* INVENTARIO */
if (interaction.isChatInputCommand() && cmd === "inventory") {
const user = getStatus(interaction.user.id);

if (!Object.keys(user.inventory).length)
return interaction.editReply("🎒 Vacío");

const list = Object.values(user.inventory)
.map(i => `${i.icon} ${i.name} x${i.qty}`)
.join("\n");

return interaction.editReply(`🎒 Inventario\n${list}`);
}

/* MONEY */
if (interaction.isChatInputCommand() && cmd === "mymoney") {
const user = getStatus(interaction.user.id);
return interaction.editReply(`💰 ${user.money}`);
}

/* DEFAULT */
if (interaction.isChatInputCommand())
return interaction.editReply("⚠️ Comando ejecutado");

} catch (err) {
console.log("❌", err);

if (interaction.deferred)
return interaction.editReply("❌ Error");

return interaction.reply({ content: "❌ Error", ephemeral: true });
}

});

/* =====================
DROP SYSTEM (SIN TOCAR)
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

if (!user.inventory[item.name]) user.inventory[item.name] = { ...item, qty: 0 };
user.inventory[item.name].qty++;

saveStatus();

message.reply({
content: `🧭 Encontraste:\n**${item.icon} ${item.name}**`
}).catch(() => {});
});

/* =====================
LOGIN
===================== */
client.login(TOKEN).catch(err => console.log("❌ Login:", err));

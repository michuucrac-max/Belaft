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
app.get("/", (_, res) => res.send("Belaf observa el Abismo 🧭"));
app.listen(PORT, () => console.log(`🌐 Express activo en ${PORT}`));

/* ===================== FILES ===================== */
const configPath = "./config.json";
const statusPath = "./status.json";
const objectsPath = "./objects.json";

const config = fs.existsSync(configPath)
? JSON.parse(fs.readFileSync(configPath, "utf8"))
: { channels: { reliquies: [], tops: null } };

const objects = fs.existsSync(objectsPath)
? JSON.parse(fs.readFileSync(objectsPath, "utf8"))
: { class4: [], class3: [], class2: [], class1: [], special: [], ultra: [] };

const status = fs.existsSync(statusPath)
? JSON.parse(fs.readFileSync(statusPath, "utf8"))
: {};

const saveStatus = () =>
fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));

const saveConfig = () =>
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

const saveObjects = () =>
fs.writeFileSync(objectsPath, JSON.stringify(objects, null, 2));

/* ===================== ROLES ===================== */
const ranks = {
silbato_rojo: "1456178133240778763",
silbato_azul: "1456178299364573348",
silbato_lunar: "1456179008625447105",
silbato_negro: "1456178700096635002",
silbato_blanco: "1456179085364695133",
narehate: "1456180289465483396"
};

/* ===================== STATUS ===================== */
function getStatus(id) {
if (!status[id]) {
status[id] = { money: 0, inventory: {} };
saveStatus();
}
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

new SlashCommandBuilder()
.setName("inventory")
.setDescription("Ver inventario"),

new SlashCommandBuilder()
.setName("mymoney")
.setDescription("Ver monedas"),

new SlashCommandBuilder()
.setName("sell")
.setDescription("Vender objetos")
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
.setName("createartefact")
.setDescription("Crear objeto")
.addStringOption(o => o.setName("categoria").setRequired(true))
.addStringOption(o => o.setName("nombre").setRequired(true))
.addStringOption(o => o.setName("icono").setRequired(true))
.addNumberOption(o => o.setName("precio").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)

];

/* ===================== REST ===================== */
const rest = new REST({ version: "10" }).setToken(TOKEN);

/* ===================== READY ===================== */
client.once(Events.ClientReady, async () => {
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

console.log(`🧭 Belaf despierta como ${client.user.tag}`);

setInterval(async () => {
if (!config.channels.tops) return;

const guild = client.guilds.cache.first();
if (!guild) return;

const members = await guild.members.fetch();
const top = [];

members.forEach(m => {
if (m.user.bot) return;
const st = getStatus(m.id);
top.push({ tag: m.user.tag, money: st.money });
});

top.sort((a, b) => b.money - a.money);
const top10 = top.slice(0, 10);

const embed = new EmbedBuilder()
.setTitle("🏆 TOP Exploradores")
.setDescription(top10.map((u, i) =>
`**${i + 1}.** ${u.tag} — 💰 ${u.money}`
).join("\n"));

const ch = guild.channels.cache.get(config.channels.tops);
if (ch) ch.send({ embeds: [embed] });

}, 600000);
});

/* ===================== INTERACTIONS ===================== */
client.on(Events.InteractionCreate, async interaction => {

if (!interaction.isChatInputCommand()) return;

/* INVENTORY */
if (interaction.commandName === "inventory") {
const user = getStatus(interaction.user.id);

if (!Object.keys(user.inventory).length)
return interaction.reply({ ephemeral: true, content: "🎒 Vacío" });

const list = Object.values(user.inventory)
.map(i => `${i.icon} ${i.name} x${i.qty}`)
.join("\n");

return interaction.reply({
ephemeral: true,
content: `🎒 Inventario\n${list}`
});
}

/* MONEY */
if (interaction.commandName === "mymoney") {
const user = getStatus(interaction.user.id);
return interaction.reply({
ephemeral: true,
content: `💰 ${user.money} monedas`
});
}

/* SELL */
if (interaction.commandName === "sell") {
const user = getStatus(interaction.user.id);
const mode = interaction.options.getString("modo");

if (!Object.keys(user.inventory).length)
return interaction.reply({ ephemeral: true, content: "❌ Vacío" });

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
content: `💰 Vendido todo por ${gain}`
});
}
}

/* SET MONEY */
if (interaction.commandName === "setmoney") {
const u = interaction.options.getUser("usuario");
const a = interaction.options.getNumber("cantidad");
const user = getStatus(u.id);

user.money += a;
saveStatus();

return interaction.reply({
ephemeral: true,
content: `💰 +${a} a ${u.tag}`
});
}

/* REMOVE MONEY */
if (interaction.commandName === "removemoney") {
const u = interaction.options.getUser("usuario");
const a = interaction.options.getNumber("cantidad");
const user = getStatus(u.id);

user.money -= a;
if (user.money < 0) user.money = 0;

saveStatus();

return interaction.reply({
ephemeral: true,
content: `💰 -${a} a ${u.tag}`
});
}

/* SEE MONEY */
if (interaction.commandName === "seemoney") {
const u = interaction.options.getUser("usuario");
const user = getStatus(u.id);

return interaction.reply({
ephemeral: true,
content: `💰 ${u.tag}: ${user.money}`
});
}

/* ===================== RANKUP ===================== */
if (interaction.commandName === "rankup") {
const member = interaction.member;
const user = getStatus(member.id);

const order = [
"silbato_rojo",
"silbato_azul",
"silbato_lunar",
"silbato_negro",
"silbato_blanco"
];

const costs = [100, 250, 500, 750, 1500];

let index = -1;

for (let i = 0; i < order.length; i++) {
if (member.roles.cache.has(ranks[order[i]])) index = i;
}

if (index === order.length - 1)
return interaction.reply({ ephemeral: true, content: "Max rank" });

const next = order[index + 1];
const cost = costs[index + 1];

if (user.money < cost)
return interaction.reply({ ephemeral: true, content: `Necesitas ${cost}` });

user.money -= cost;

await member.roles.add(ranks[next]);
saveStatus();

return interaction.reply({
ephemeral: true,
content: `Subiste a ${next}`
});
}
});

/* ===================== DROP SYSTEM ===================== */
client.on(Events.MessageCreate, async message => {

if (message.author.bot) return;
if (!config.channels.reliquies.includes(message.channel.id)) return;

if (Math.random() > 0.2) return;

const pool = objects.class4.concat(objects.class3, objects.special);
const item = pool[Math.floor(Math.random() * pool.length)];

const user = getStatus(message.author.id);

if (!user.inventory[item.name]) {
user.inventory[item.name] = { ...item, qty: 0 };
}

user.inventory[item.name].qty++;
saveStatus();

try {
await message.author.send(
`🧭 Encontraste: ${item.icon} ${item.name}`
);
} catch {
message.reply(`🧭 ${item.name} obtenido`);
}
});

/* ===================== LOGIN ===================== */
client.login(TOKEN);

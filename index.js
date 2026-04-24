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
RoleSelectMenuBuilder,
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
: { 
  channels: { reliquies: [], trade: null, sell: null, tops: null },
  ranks: {} // 🔥 NUEVO
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

/* ===================== STATUS ===================== */
function getStatus(id) {
if (!status[id]) status[id] = { money: 0, inventory: {}, messages: 0 };
saveStatus();
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
o.setName("modo").setDescription("Modo").setRequired(true)
.addChoices({ name: "Uno", value: "one" }, { name: "Todo", value: "all" })
),

new SlashCommandBuilder()
.setName("setchannelreliquies")
.setDescription("Configurar drops")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("setchanneltops")
.setDescription("Configurar tops")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

// 🔥 NUEVO
new SlashCommandBuilder()
.setName("setranks")
.setDescription("Configurar rangos del servidor")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("rankup")
.setDescription("Subir de rango"),

new SlashCommandBuilder()
.setName("setmoney")
.setDescription("Dar dinero")
.addUserOption(o => o.setName("usuario").setRequired(true))
.addNumberOption(o => o.setName("cantidad").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

/* ===================== REST ===================== */
const rest = new REST({ version: "10" }).setToken(TOKEN);

/* ===================== READY ===================== */
client.once(Events.ClientReady, async () => {
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
console.log(`🧭 Belaf despierta como ${client.user.tag}`);
});

/* ===================== INTERACTIONS ===================== */
client.on(Events.InteractionCreate, async interaction => {
if (!interaction.isChatInputCommand() && !interaction.isChannelSelectMenu() && !interaction.isRoleSelectMenu()) return;

/* ===== SET CHANNEL ===== */
if (interaction.isChatInputCommand() && interaction.commandName === "setchannelreliquies") {
const menu = new ChannelSelectMenuBuilder()
.setCustomId("set_reliquies")
.addChannelTypes(ChannelType.GuildText)
.setMinValues(1)
.setMaxValues(6);

return interaction.reply({
ephemeral: true,
components: [new ActionRowBuilder().addComponents(menu)]
});
}

if (interaction.isChannelSelectMenu() && interaction.customId === "set_reliquies") {
config.channels.reliquies = interaction.values;
saveConfig();

return interaction.update({ content: "📜 Canales configurados", components: [] });
}

/* ===== SET RANKS ===== */
if (interaction.isChatInputCommand() && interaction.commandName === "setranks") {

const menu = new RoleSelectMenuBuilder()
.setCustomId("set_ranks")
.setMinValues(2)
.setMaxValues(10);

return interaction.reply({
ephemeral: true,
content: "Selecciona los rangos en orden de menor a mayor",
components: [new ActionRowBuilder().addComponents(menu)]
});
}

if (interaction.isRoleSelectMenu() && interaction.customId === "set_ranks") {

config.ranks[interaction.guild.id] = interaction.values;
saveConfig();

return interaction.update({
content: "✅ Rangos configurados correctamente",
components: []
});
}

/* ===== INVENTORY ===== */
if (interaction.commandName === "inventory") {
const user = getStatus(interaction.user.id);
if (!Object.keys(user.inventory).length)
return interaction.reply({ ephemeral: true, content: "🎒 Vacío" });

const list = Object.values(user.inventory)
.map(i => `${i.icon} ${i.name} x${i.qty}`)
.join("\n");

return interaction.reply({ ephemeral: true, content: list });
}

/* ===== MONEY ===== */
if (interaction.commandName === "mymoney") {
const user = getStatus(interaction.user.id);
return interaction.reply({ ephemeral: true, content: `💰 ${user.money}` });
}

/* ===== RANKUP ===== */
if (interaction.commandName === "rankup") {

const member = interaction.member;
const st = getStatus(member.id);
const guildId = interaction.guild.id;

const roleOrder = config.ranks[guildId];

if (!roleOrder)
return interaction.reply({ ephemeral:true, content:"❌ Usa /setranks primero" });

const costs = [100,250,500,750,1500,3000];

let index = -1;

for (let i = roleOrder.length - 1; i >= 0; i--) {
if (member.roles.cache.has(roleOrder[i])) {
index = i;
break;
}
}

if (index === roleOrder.length - 1)
return interaction.reply({ content:"Máximo rango" });

const nextRole = roleOrder[index + 1];
const cost = costs[index + 1] || 1000;

if (st.money < cost)
return interaction.reply({ content:`Necesitas ${cost}` });

st.money -= cost;
await member.roles.add(nextRole);

saveStatus();

return interaction.reply({ content:"Subiste de rango" });
}

});

/* ===================== DROP ===================== */
client.on(Events.MessageCreate, message => {
if (message.author.bot || !message.guild) return;
if (!config.channels.reliquies.includes(message.channel.id)) return;

const user = getStatus(message.author.id);
user.messages++;

if (user.messages % 10 !== 0) return;

const pool = objects.class4;
if (!pool.length) return;

const item = pool[Math.floor(Math.random() * pool.length)];

if (!user.inventory[item.name])
user.inventory[item.name] = { ...item, qty: 0 };

user.inventory[item.name].qty++;

saveStatus();

message.reply(`🧭 ${item.icon} ${item.name}`);
});

/* ===================== LOGIN ===================== */
client.login(TOKEN);

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
ButtonBuilder,
ButtonStyle
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
app.listen(PORT, () => console.log(`🌐 Express levantado en puerto ${PORT}`));

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
: { class4: [], class3: [], class2: [], special: [] };

const status = fs.existsSync(statusPath)
? JSON.parse(fs.readFileSync(statusPath, "utf8"))
: {};

const saveStatus = () =>
fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));

const saveConfig = () =>
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

/* =====================
RANGOS
===================== */
const RANK_ROLES = [
{ name: "Bell", id: "1456176950849572979" },
{ name: "Silbato rojo", id: "1456178133240778763" },
{ name: "Silbato azul", id: "1456178299364573348" },
{ name: "Silbato lunar", id: "1456179008625447105" },
{ name: "Silbato negro", id: "1456178700096635002" },
{ name: "Silbato blanco", id: "1456179085364695133" }
];

const NAREHATE_ROLE_ID = "1456180289465483396";

/* =====================
STATUS
===================== */
function getStatus(id, member = null) {
if (!status[id]) {
status[id] = {
money: 0,
rank: "Bell",
humanity: true,
inventory: {},
messages: 0
};
}

if (member) {
const order = [
"Bell",
"Silbato rojo",
"Silbato azul",
"Silbato lunar",
"Silbato negro",
"Silbato blanco",
"Narehate"
];
const roles = member.roles.cache.map(r => r.name);
const matched = [...order].reverse().find(r => roles.includes(r));
if (matched) status[id].rank = matched;
status[id].humanity = !member.roles.cache.has(NAREHATE_ROLE_ID);
}

saveStatus();
return status[id];
}

function getDiscordRank(member) {
if (!member) return "Sin rango";
if (member.roles.cache.has(NAREHATE_ROLE_ID)) return "Narehate";
for (let i = RANK_ROLES.length - 1; i >= 0; i--) {
if (member.roles.cache.has(RANK_ROLES[i].id)) return RANK_ROLES[i].name;
}
return "Sin rango";
}

/* =====================
DROPS
===================== */
client.on(Events.MessageCreate, message => {
if (message.author.bot || !message.guild) return;
if (!config.channels.reliquies.includes(message.channel.id)) return;

const depth = config.channels.reliquies.indexOf(message.channel.id);
const user = getStatus(message.author.id, message.member);
user.messages++;

if (user.messages % 5 !== 0) return;

const pools = [
objects.class4,
objects.class3,
objects.class2,
objects.special,
objects.special,
objects.special
];

const pool = pools[depth] ?? objects.class4;
if (!pool.length) return;

const item = pool[Math.floor(Math.random() * pool.length)];

if (!user.inventory[item.name]) {
user.inventory[item.name] = {
name: item.name,
icon: item.icon,
price: item.price ?? item.value ?? 0,
qty: 0
};
}

user.inventory[item.name].qty++;
saveStatus();

message.reply(`🧭 Encontraste **${item.icon} ${item.name}**`);
});

/* =====================
COMMANDS
===================== */
const commands = [
new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),
new SlashCommandBuilder().setName("rankup").setDescription("Subir de rango"),
new SlashCommandBuilder()
.setName("sell")
.setDescription("Vender reliquias")
.addStringOption(o =>
o.setName("mode").setDescription("Modo").setRequired(true)
.addChoices({ name: "Uno", value: "one" }, { name: "Todo", value: "all" })
),
new SlashCommandBuilder()
.setName("trade")
.setDescription("Intercambiar reliquias")
.addUserOption(o => o.setName("user").setDescription("Usuario").setRequired(true)),
new SlashCommandBuilder().setName("setchannelreliquies").setDescription("Configurar drops").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
new SlashCommandBuilder().setName("setchanneltrade").setDescription("Configurar trade").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
new SlashCommandBuilder().setName("setchannelsell").setDescription("Configurar sell").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
new SlashCommandBuilder().setName("setchanneltops").setDescription("Configurar tops").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {
if (!interaction.isChatInputCommand() && !interaction.isChannelSelectMenu() && !interaction.isStringSelectMenu() && !interaction.isButton()) return;

const user = getStatus(interaction.user.id, interaction.member);

/* ===== INVENTORY ===== */
if (interaction.isChatInputCommand() && interaction.commandName === "inventory") {
if (!Object.keys(user.inventory).length)
return interaction.reply({ ephemeral: true, content: `🎒 Inventario vacío.` });

const list = Object.values(user.inventory)
.map(i => `${i.icon} ${i.name} x${i.qty}`)
.join("\n");

return interaction.reply({ ephemeral: true, content: `🎒 **Inventario**\n${list}` });
}

/* ===== MONEY ===== */
if (interaction.isChatInputCommand() && interaction.commandName === "mymoney") {
return interaction.reply({ ephemeral: true, content: `💰 ${user.money} monedas.` });
}

/* ===== RANKUP ===== */
if (interaction.isChatInputCommand() && interaction.commandName === "rankup") {
if (!user.humanity) return interaction.reply({ ephemeral: true, content: `❌ Narehate.` });

const order = ["Bell","Silbato rojo","Silbato azul","Silbato lunar","Silbato negro","Silbato blanco"];
const costs = [0,100,300,700,1500,3000];

const i = order.indexOf(user.rank);
if (i === order.length - 1) return interaction.reply({ ephemeral: true, content: `🏅 Máximo.` });

if (user.money < costs[i+1]) return interaction.reply({ ephemeral: true, content: `💰 Insuficiente.` });

user.money -= costs[i+1];
user.rank = order[i+1];

const member = interaction.member;
RANK_ROLES.forEach(r => member.roles.remove(r.id).catch(()=>{}));
const role = RANK_ROLES.find(r => r.name === user.rank);
if (role) member.roles.add(role.id).catch(()=>{});

saveStatus();
return interaction.reply(`🏅 Ascendiste a **${user.rank}**`);
}

/* ===== SELL ===== */
if (interaction.isChatInputCommand() && interaction.commandName === "sell") {
if (!Object.keys(user.inventory).length)
return interaction.reply({ ephemeral: true, content: `🎒 Vacío.` });

let gain = 0;
for (const i of Object.values(user.inventory)) gain += i.price * i.qty;
user.money += gain;
user.inventory = {};
saveStatus();

return interaction.reply({ ephemeral: true, content: `💰 Vendido todo (+${gain})` });
}

/* ===== TRADE ===== */
if (interaction.isChatInputCommand() && interaction.commandName === "trade") {
if (interaction.channelId !== config.channels.trade)
return interaction.reply({ ephemeral: true, content: `❌ Canal incorrecto.` });

const target = interaction.options.getUser("user");
if (!target || target.id === interaction.user.id)
return interaction.reply({ ephemeral: true, content: `❌ Usuario inválido.` });

if (!global.tradeSessions) global.tradeSessions = {};
const id = `${interaction.user.id}_${target.id}`;

global.tradeSessions[id] = {
fromId: interaction.user.id,
toId: target.id,
itemsFrom: {},
itemsTo: {},
confirmed: {}
};

const makeMenu = (inv, cid) =>
new StringSelectMenuBuilder()
.setCustomId(cid)
.setPlaceholder("Selecciona objetos")
.setMinValues(1)
.setMaxValues(Object.keys(inv).length)
.addOptions(Object.values(inv).map(i => ({
label: `${i.name} x${i.qty}`,
value: i.name
})));

return interaction.reply({
ephemeral: true,
components: [
new ActionRowBuilder().addComponents(makeMenu(user.inventory, `trade_${interaction.user.id}`)),
new ActionRowBuilder().addComponents(makeMenu(getStatus(target.id).inventory, `trade_${target.id}`))
]
});
}

if (interaction.isStringSelectMenu() && interaction.customId.startsWith("trade_")) {
const uid = interaction.customId.replace("trade_", "");
const session = Object.values(global.tradeSessions).find(s => s.fromId === uid || s.toId === uid);
if (!session) return;

const inv = getStatus(interaction.user.id).inventory;
const items = {};
interaction.values.forEach(v => items[v] = inv[v].qty);

if (interaction.user.id === session.fromId) session.itemsFrom = items;
else session.itemsTo = items;

if (Object.keys(session.itemsFrom).length && Object.keys(session.itemsTo).length) {
const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(`confirm_${session.fromId}_${session.toId}`).setLabel("Confirmar").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId(`cancel_${session.fromId}_${session.toId}`).setLabel("Cancelar").setStyle(ButtonStyle.Danger)
);
return interaction.update({ content: "⚖️ Confirmen ambos.", components: [row] });
}
}

if (interaction.isButton()) {
const [act, f, t] = interaction.customId.split("_");
const s = global.tradeSessions?.[`${f}_${t}`];
if (!s) return;

if (act === "confirm") {
s.confirmed[interaction.user.id] = true;
if (Object.keys(s.confirmed).length === 2) {
const A = getStatus(f);
const B = getStatus(t);

for (const [i,q] of Object.entries(s.itemsFrom)) {
B.inventory[i] = B.inventory[i] || {...A.inventory[i], qty:0};
B.inventory[i].qty += q;
A.inventory[i].qty -= q;
if (A.inventory[i].qty <= 0) delete A.inventory[i];
}

for (const [i,q] of Object.entries(s.itemsTo)) {
A.inventory[i] = A.inventory[i] || {...B.inventory[i], qty:0};
A.inventory[i].qty += q;
B.inventory[i].qty -= q;
if (B.inventory[i].qty <= 0) delete B.inventory[i];
}

delete global.tradeSessions[`${f}_${t}`];
saveStatus();
return interaction.update({ content: "✅ Trade completado.", components: [] });
}
}

if (act === "cancel") {
delete global.tradeSessions[`${f}_${t}`];
return interaction.update({ content: "❌ Cancelado.", components: [] });
}
}
});

/* =====================
TOP
===================== */
async function sendTopExploradores() {
if (!config.channels.tops) return;
const ch = await client.channels.fetch(config.channels.tops).catch(()=>null);
if (!ch) return;

const list = Object.entries(status)
.sort((a,b)=> (b[1].money||0)-(a[1].money||0))
.slice(0,10)
.map(([id,u],i)=>`**${i+1}.** ${u.money} 💰`)
.join("\n");

ch.send(`🏆 **TOP**\n${list}`);
}

setInterval(sendTopExploradores, 600000);

/* =====================
READY
===================== */
client.once(Events.ClientReady, async () => {
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
console.log(`🧭 Belaf despierta`);
});

/* =====================
LOGIN
===================== */
client.login(TOKEN);

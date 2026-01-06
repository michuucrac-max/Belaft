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
PermissionsBitField
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
STATUS MANAGEMENT
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
const roleOrder = [
"Bell",
"Silbato rojo",
"Silbato azul",
"Silbato lunar",
"Silbato negro",
"Silbato blanco",
"Narehate"
];
const memberRoles = member.roles.cache.map(r => r.name);
const matchedRole = [...roleOrder].reverse().find(r =>
memberRoles.includes(r)
);
if (matchedRole) status[id].rank = matchedRole;
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
DROP SYSTEM
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
o.setName("mode").setDescription("Modo de venta").setRequired(true)
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
if (!interaction.isChatInputCommand() && !interaction.isChannelSelectMenu() && !interaction.isStringSelectMenu()) return;

const user = getStatus(interaction.user.id, interaction.member);

/* ===== SETCHANNEL COMMANDS ===== */
if (interaction.isChatInputCommand() && interaction.commandName.startsWith("setchannel")) {
const id = interaction.commandName.replace("setchannel", "");
const multi = id === "reliquies";

const menu = new ChannelSelectMenuBuilder()
.setCustomId(setchannel_${id})
.setPlaceholder("Selecciona canal(es)")
.addChannelTypes(ChannelType.GuildText)
.setMinValues(1)
.setMaxValues(multi ? 6 : 1);

return interaction.reply({
ephemeral: true,
components: [new ActionRowBuilder().addComponents(menu)]
});

}

if (interaction.isChannelSelectMenu() && interaction.customId.startsWith("setchannel_")) {
const id = interaction.customId.replace("setchannel_", "");

if (id === "reliquies") config.channels.reliquies = interaction.values;
if (id === "trade") config.channels.trade = interaction.values[0];
if (id === "sell") config.channels.sell = interaction.values[0];
if (id === "tops") config.channels.tops = interaction.values[0];

saveConfig();
return interaction.update({ content: 📜 Canal configurado., components: [] });

}

/* ===== INVENTORY ===== */
if (interaction.isChatInputCommand() && interaction.commandName === "inventory") {
if (!Object.keys(user.inventory).length)
return interaction.reply({ ephemeral: true, content: 🎒 Tu inventario está vacío. });

const list = Object.values(user.inventory)
.map(i => ${i.icon} ${i.name} x${i.qty})
.join("\n");

return interaction.reply({ ephemeral: true, content: 🎒 **Inventario**\n${list} });

}

/* ===== MY MONEY ===== */
if (interaction.isChatInputCommand() && interaction.commandName === "mymoney") {
return interaction.reply({ ephemeral: true, content: 💰 Tienes ${user.money} monedas. });
}

/* ===== RANKUP AUTOMÁTICO CON ROL ===== */
if (interaction.isChatInputCommand() && interaction.commandName === "rankup") {
if (!user.humanity)
return interaction.reply({ ephemeral: true, content: ❌ Los narehates no pueden ascender. });

const order = ["Bell","Silbato rojo","Silbato azul","Silbato lunar","Silbato negro","Silbato blanco"];
const costs = [0,100,300,700,1500,3000];

const i = order.indexOf(user.rank);
if (i === order.length - 1)
return interaction.reply({ ephemeral: true, content: 🏅 Rango máximo. });

const cost = costs[i + 1];
if (user.money < cost)
return interaction.reply({ ephemeral: true, content: 💰 Necesitas ${cost} monedas. });

user.money -= cost;
const newRank = order[i + 1];
user.rank = newRank;

// Asignar rol automáticamente
const member = interaction.member;
if(member) {
// Primero quitar todos los roles de rango
RANK_ROLES.forEach(r => member.roles.remove(r.id).catch(()=>{}));

// Luego agregar el nuevo rol  
const role = RANK_ROLES.find(r => r.name === newRank);  
if(role) member.roles.add(role.id).catch(()=>{});

}

saveStatus();

return interaction.reply(`🏅 Ascendiste a **${newRank}** (-${cost} 💰`));
}

/* ===== SELL ===== */
if (interaction.isChatInputCommand() && interaction.commandName === "sell") {
const mode = interaction.options.getString("mode");
if (!Object.keys(user.inventory).length)
return interaction.reply({ ephemeral: true, content: 🎒 No tienes objetos. });

let sold = [];
if (mode === "one") {
const item = Object.values(user.inventory)[0];
user.money += item.price;
item.qty--;
sold.push(${item.icon} ${item.name});
if (item.qty <= 0) delete user.inventory[item.name];
} else {
for (const i of Object.values(user.inventory)) {
user.money += i.price * i.qty;
sold.push(${i.icon} ${i.name} x${i.qty});
}
user.inventory = {};
}

saveStatus();
return interaction.reply({ ephemeral: true, content: 💰 Vendiste: ${sold.join(", ")} });

}

/* ===== TRADE ===== */
if (interaction.isChatInputCommand() && interaction.commandName === "trade") {
if (interaction.channelId !== config.channels.trade)
return interaction.reply({ ephemeral: true, content: ❌ Canal incorrecto. });

const targetUser = interaction.options.getUser("user");
if (!targetUser) return;

const target = getStatus(targetUser.id, interaction.guild.members.cache.get(targetUser.id));
const user = getStatus(interaction.user.id, interaction.member);

if (!Object.keys(user.inventory).length)
return interaction.reply({ ephemeral: true, content: 🎒 Tu inventario está vacío. });
if (!Object.keys(target.inventory).length)
return interaction.reply({ ephemeral: true, content: 🎒 El inventario del otro usuario está vacío. });

if (!global.tradeSessions) global.tradeSessions = {};
const sessionId = ${interaction.user.id}_${targetUser.id};
if (!global.tradeSessions[sessionId]) {
global.tradeSessions[sessionId] = { from: {}, to: {}, status: "selecting" };
}

const createMenu = (inv, customId) => {
return new StringSelectMenuBuilder()
.setCustomId(customId)
.setPlaceholder("Selecciona los objetos que quieres ofrecer")
.setMinValues(1)
.setMaxValues(Object.keys(inv).length)
.addOptions(Object.values(inv).map(i => ({
label: ${i.name} x${i.qty},
value: i.name,
description: Valor: ${i.price} monedas
})));
};

const rowUser = new ActionRowBuilder().addComponents(createMenu(user.inventory, trade_select_${interaction.user.id}));
const rowTarget = new ActionRowBuilder().addComponents(createMenu(target.inventory, trade_select_${targetUser.id}));

return interaction.reply({
ephemeral: true,
content: `🔁 Trade iniciado con ${targetUser.tag}. Selecciona tus objetos:`,
components: [rowUser, rowTarget]
});

}

/* ===== SELECCIÓN DE OBJETOS Y CONFIRM ===== */
if (interaction.isStringSelectMenu()) {
const id = interaction.customId;

if (id.startsWith("trade_select_")) {
const userId = id.replace("trade_select_", "");
const session = Object.values(global.tradeSessions || {}).find(
s => s.from[userId] || s.to[userId] || s.status === "selecting"
);
if (!session) return;

const isFrom = interaction.user.id === userId;
const userInv = getStatus(interaction.user.id, interaction.guild.members.cache.get(interaction.user.id)).inventory;

session[isFrom ? "from" : "to"] = {};
for (const itemName of interaction.values) {
const item = userInv[itemName];
if (item) session[isFrom ? "from" : "to"][itemName] = item.qty;
}

if (Object.keys(session.from).length && Object.keys(session.to).length) {
session.status = "confirm";

const fromList = Object.entries(session.from).map(([name, qty]) => `${name} x${qty}`).join("\n");    
const toList = Object.entries(session.to).map(([name, qty]) => `${name} x${qty}`).join("\n");    

const confirmRow = new ActionRowBuilder().addComponents(    
  new StringSelectMenuBuilder()    
    .setCustomId(`trade_confirm_${interaction.user.id}_${interaction.user.tag}`)    
    .setPlaceholder(`✅ Aceptar / ❌ Rechazar`)    
    .addOptions([    
      { label: "Aceptar", value: "accept", description: "Confirmar trade" },    
      { label: "Rechazar", value: "reject", description: "Cancelar trade" }    
    ])    
);    

return interaction.update({    
  content: `⚖️ Trade listo para confirmación:\n\n**Tú das:**\n${fromList}\n\n**Recibes:**\n${toList}\n\nSelecciona Aceptar o Rechazar.`,    
  components: [confirmRow]    
});

} else {
return interaction.update({
content: `🔁 Esperando que el otro usuario seleccione sus objetos...`,
components: []
});
}
}

if (id.startsWith("trade_confirm_")) {
const [, fromId] = id.split("_");
const session = global.tradeSessions[${fromId}_${interaction.user.id}] || global.tradeSessions[${interaction.user.id}_${fromId}];
if (!session || session.status !== "confirm") return;

if (interaction.values[0] === "reject") {
delete global.tradeSessions[${fromId}_${interaction.user.id}];
delete global.tradeSessions[${interaction.user.id}_${fromId}];
return interaction.update({ content: `❌ Trade cancelado.`, components: [] });
}

const fromUser = getStatus(fromId, interaction.guild.members.cache.get(fromId));
const toUser = getStatus(interaction.user.id, interaction.guild.members.cache.get(interaction.user.id));

for (const [name, qty] of Object.entries(session.from)) {
if (!fromUser.inventory[name] || fromUser.inventory[name].qty < qty) continue;
fromUser.inventory[name].qty -= qty;
if (!toUser.inventory[name]) toUser.inventory[name] = { ...fromUser.inventory[name], qty: 0 };
toUser.inventory[name].qty += qty;
if (fromUser.inventory[name].qty <= 0) delete fromUser.inventory[name];
}

for (const [name, qty] of Object.entries(session.to)) {
if (!toUser.inventory[name] || toUser.inventory[name].qty < qty) continue;
toUser.inventory[name].qty -= qty;
if (!fromUser.inventory[name]) fromUser.inventory[name] = { ...toUser.inventory[name], qty: 0 };
fromUser.inventory[name].qty += qty;
if (toUser.inventory[name].qty <= 0) delete toUser.inventory[name];
}

saveStatus();
delete global.tradeSessions[${fromId}_${interaction.user.id}];
delete global.tradeSessions[${interaction.user.id}_${fromId}];

return interaction.update({ content: `✅ Trade completado exitosamente.`, components: [] });
}

}
});

/* =====================
TOP EXPLORADORES
===================== */
async function sendTopExploradores() {
if (!config.channels.tops) return;

const channel = await client.channels.fetch(config.channels.tops).catch(() => null);
if (!channel || !channel.guild) return;

const data = [];

for (const [id, u] of Object.entries(status)) {
let member = null;
try { member = await channel.guild.members.fetch(id); } catch {}

const totalItems = Object.values(u.inventory ?? {}).reduce((sum, i) => sum + (i.qty ?? 0), 0);

data.push({
id,
tag: member ? member.user.tag : "Usuario salido",
rank: getDiscordRank(member),
money: u.money ?? 0,
items: totalItems
});

}

const top = data.sort((a,b) => b.money - a.money).slice(0,10);
if (!top.length) return;

const text = top.map((u,i) => `
 **${i+1}. ${u.tag}**\n🧭 Rango: **${u.rank}**\n💰 Dinero: **${u.money}**\n🎒 Objetos: **${u.items}** `
).join("\n\n");

await channel.send({ content: 🏆 **TOP EXPLORADORES** 🏆\n\n${text} });
}

/* Enviar top cada 10 minutos */
setInterval(sendTopExploradores, 10 * 60 * 1000);

/* =====================
SAFE SAVE
===================== */
process.on("SIGINT", () => { saveStatus(); process.exit(); });
process.on("SIGTERM", () => { saveStatus(); process.exit(); });
process.on("uncaughtException", err => { console.error(err); saveStatus(); process.exit(1); });

/* =====================
CLIENT READY
===================== */
client.once(Events.ClientReady, async () => {
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
console.log(`🧭 Belaf despierta como ${client.user.tag}`);

// Envía top cada 1 H (3600000 ms)
setInterval(sendTopExploradores, 3600000);
});

/* =====================
LOGIN
===================== */
client.login(TOKEN).then(() => console.log(`🔑 Intentando conectar con Discord...`));

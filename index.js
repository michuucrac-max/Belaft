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

/* ===================== */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

/* ===================== */
const app = express();
app.get("/", (_, res) => res.send("Belaf observa el Abismo 🧭"));
app.listen(PORT, () => console.log(`🌐 Express activo en ${PORT}`));

/* ===================== */
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

const saveStatus = () => fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
const saveConfig = () => fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
const saveObjects = () => fs.writeFileSync(objectsPath, JSON.stringify(objects, null, 2));

function getStatus(id) {
if (!status[id]) status[id] = { money: 0, inventory: {}, messages: 0 };
return status[id];
}

/* ===================== RANGOS */
function getMemberRank(member) {
const roles = member.roles.cache.map(r => r.name.toLowerCase());
const order = ["bell","silbato rojo","silbato azul","silbato lunar","silbato negro","silbato blanco"];

for (let i = order.length - 1; i >= 0; i--) {
if (roles.includes(order[i])) return i;
}
return -1;
}

/* ===================== DROP PROB */
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

let total = items.reduce((a, b) => a + b.rarity, 0);
let rand = Math.random() * total;

for (const item of items) {
rand -= item.rarity;
if (rand <= 0) return item;
}
return items[0];
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

const commands = [
new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),

new SlashCommandBuilder()
.setName("sell")
.setDescription("Vender objetos")
.addStringOption(o =>
o.setName("modo").setRequired(true)
.addChoices({ name:"Uno",value:"one" },{ name:"Todo",value:"all" })
),

new SlashCommandBuilder().setName("rankup").setDescription("Subir rango"),

new SlashCommandBuilder()
.setName("createartefact")
.setDescription("Crear artefacto")
.addStringOption(o=>o.setName("categoria").setRequired(true))
.addStringOption(o=>o.setName("nombre").setRequired(true))
.addStringOption(o=>o.setName("icono").setRequired(true))
.addNumberOption(o=>o.setName("precio").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

const rest = new REST({ version:"10" }).setToken(TOKEN);

client.once(Events.ClientReady, async ()=>{
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
console.log(`🧭 Belaf listo como ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {

try {

/* ===================== MENÚS */
if (interaction.isStringSelectMenu()) {

if (interaction.customId.startsWith("sell_")) {

const mode = interaction.customId.replace("sell_", "");
const user = getStatus(interaction.user.id);
const name = interaction.values[0];
const item = user.inventory[name];

if (!item)
return interaction.update({ content:"❌ Objeto inválido", components:[] });

let gain = 0;

if (mode === "one") {
gain = (item.price ?? 0);
item.qty--;
} else {
gain = item.qty * (item.price ?? 0);
delete user.inventory[name];
}

if (item.qty <= 0) delete user.inventory[name];

user.money += gain;
saveStatus();

return interaction.update({
content:`💰 Vendiste ${name} por ${gain}`,
components:[]
});
}

return;
}

/* ===================== COMANDOS */
if (!interaction.isChatInputCommand()) return;

await interaction.deferReply({ ephemeral:true });

const cmd = interaction.commandName;

/* INVENTORY */
if (cmd==="inventory"){
const user = getStatus(interaction.user.id);

if (!Object.keys(user.inventory).length)
return interaction.editReply("🎒 Vacío");

const list = Object.values(user.inventory)
.map(i=>`${i.icon} ${i.name} x${i.qty} — 💰 ${i.price ?? 0}`)
.join("\n");

return interaction.editReply(`🎒 Inventario\n${list}`);
}

/* MONEY */
if (cmd==="mymoney"){
const user = getStatus(interaction.user.id);
return interaction.editReply(`💰 ${user.money}`);
}

/* SELL */
if (cmd==="sell"){
const user = getStatus(interaction.user.id);
const mode = interaction.options.getString("modo");

if (!Object.keys(user.inventory).length)
return interaction.editReply("❌ No tienes objetos");

if (mode==="all"){
let gain=0;
for (const i of Object.values(user.inventory)){
gain += (i.price??0)*i.qty;
}
user.money+=gain;
user.inventory={};
saveStatus();
return interaction.editReply(`💰 Vendido todo por ${gain}`);
}

const menu = new StringSelectMenuBuilder()
.setCustomId(`sell_${mode}`)
.setPlaceholder("Selecciona objeto")
.addOptions(Object.values(user.inventory).map(i=>({
label:i.name,
value:i.name,
description:`x${i.qty} | 💰 ${i.price ?? 0}`
})));

return interaction.editReply({
content:"Selecciona objeto",
components:[new ActionRowBuilder().addComponents(menu)]
});
}

/* RANKUP */
if (cmd==="rankup"){
const member = interaction.member;
const st = getStatus(member.id);

const order = ["bell","silbato rojo","silbato azul","silbato lunar","silbato negro","silbato blanco"];
const costs = [100,250,500,750,1500,3000];

let current = getMemberRank(member);

if (current===order.length-1)
return interaction.editReply("🏆 Máximo rango");

const next=current+1;

if (st.money<costs[next])
return interaction.editReply(`❌ Te faltan ${costs[next]-st.money}`);

st.money-=costs[next];

const role = member.guild.roles.cache.find(r=>r.name.toLowerCase()===order[next]);
if (role) await member.roles.add(role).catch(()=>{});

saveStatus();

return interaction.editReply(`🎖️ Subiste a ${order[next]}`);
}

/* CREATE */
if (cmd==="createartefact"){
const c=interaction.options.getString("categoria");
const n=interaction.options.getString("nombre");
const i=interaction.options.getString("icono");
const p=interaction.options.getNumber("precio");

if(!objects[c]) return interaction.editReply("❌ Categoría inválida");

objects[c].push({ name:n, icon:i, price:p });
saveObjects();

return interaction.editReply(`✨ Creado ${n}`);
}

/* DEFAULT */
return interaction.editReply("⚠️ Comando no reconocido");

} catch(e){
console.log("❌", e);

if (interaction.deferred)
return interaction.editReply("❌ Error interno");

return interaction.reply({ content:"❌ Error", ephemeral:true });
}

});

client.on(Events.MessageCreate, message => {

if (message.author.bot || !message.guild) return;
if (!Array.isArray(config.channels.reliquies)) return;
if (!config.channels.reliquies.includes(message.channel.id)) return;

const user = getStatus(message.author.id);

user.messages++;
saveStatus();

if (user.messages % 10 !== 0) return;

const item = rollItem();
if (!item) return;

if (!user.inventory[item.name])
user.inventory[item.name] = { ...item, qty: 0 };

user.inventory[item.name].qty++;

saveStatus();

message.reply({
content:`🧭 Encontraste ${item.icon} ${item.name}`
}).catch(()=>{});

});

/* ===================== LOGIN */
client.login(TOKEN).catch(err => console.log("❌ Login:", err));

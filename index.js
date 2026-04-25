/* =====================
IMPORTS
===================== */
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
ANTI CRASH
===================== */
process.on("unhandledRejection", console.log);
process.on("uncaughtException", console.log);

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
: { channel: null };

const objects = fs.existsSync(objectsPath)
? JSON.parse(fs.readFileSync(objectsPath, "utf8"))
: { class4: [], class3: [], class2: [], class1: [], special: [], ultra: [] };

const status = fs.existsSync(statusPath)
? JSON.parse(fs.readFileSync(statusPath, "utf8"))
: {};

const saveStatus = () => fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
const saveConfig = () => fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

function getStatus(id) {
if (!status[id]) status[id] = { money: 0, inventory: {} };
return status[id];
}

/* =====================
RANGOS FLEXIBLES
===================== */
const rankOrder = [
"bell",
"silbato rojo",
"silbato azul",
"silbato lunar",
"silbato negro",
"silbato blanco"
];

const rankCosts = [100, 250, 500, 750, 1500, 3000];

function getMemberRank(member) {
const roles = member.roles.cache.map(r => r.name.toLowerCase());
for (let i = rankOrder.length - 1; i >= 0; i--) {
if (roles.includes(rankOrder[i])) return i;
}
return -1;
}

/* =====================
PROBABILIDAD DROP
===================== */
function rollItem() {
const all = [
...objects.class4.map(i => ({ ...i, chance: 70 })),
...objects.class3.map(i => ({ ...i, chance: 20 })),
...objects.class2.map(i => ({ ...i, chance: 8 })),
...objects.class1.map(i => ({ ...i, chance: 4 })),
...objects.special.map(i => ({ ...i, chance: 2 })),
...objects.ultra.map(i => ({ ...i, chance: 0.5 }))
];

if (!all.length) return null;

const total = all.reduce((a,b)=>a+b.chance,0);
let rand = Math.random() * total;

for (const item of all) {
rand -= item.chance;
if (rand <= 0) return item;
}
return null;
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
COMMANDS
===================== */
const commands = [
new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),

new SlashCommandBuilder()
.setName("sell")
.setDescription("Vender reliquias")
.addStringOption(o =>
o.setName("modo").setRequired(true)
.addChoices(
{ name:"Uno", value:"one" },
{ name:"Todo", value:"all" }
)
),

new SlashCommandBuilder()
.setName("setchannelreliquies")
.setDescription("Configurar canal de drops")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("rankup")
.setDescription("Subir rango")
];

/* =====================
REGISTER
===================== */
const rest = new REST({ version:"10" }).setToken(TOKEN);

client.once(Events.ClientReady, async ()=>{
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
console.log(`🧭 Belaf listo como ${client.user.tag}`);
});

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {

try {

/* SET CHANNEL */
if (interaction.isChatInputCommand() && interaction.commandName === "setchannelreliquies") {

const menu = new ChannelSelectMenuBuilder()
.setCustomId("set_channel")
.addChannelTypes(ChannelType.GuildText)
.setMinValues(1)
.setMaxValues(1);

return interaction.reply({
ephemeral:true,
components:[new ActionRowBuilder().addComponents(menu)]
});
}

if (interaction.isChannelSelectMenu() && interaction.customId === "set_channel") {

config.channel = interaction.values[0];
saveConfig();

return interaction.update({
content:"✅ Canal configurado",
components:[]
});
}

/* MENÚ SELL */
if (interaction.isStringSelectMenu()) {

if (interaction.customId.startsWith("sell_")) {

const mode = interaction.customId.replace("sell_","");
const user = getStatus(interaction.user.id);
const name = interaction.values[0];
const item = user.inventory[name];

if (!item)
return interaction.update({ content:"❌ Objeto inválido", components:[] });

let gain = 0;

if (mode === "one") {
gain = item.price ?? 0;
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

/* COMANDOS */
if (!interaction.isChatInputCommand()) return;

await interaction.deferReply({ ephemeral:true });

const cmd = interaction.commandName;

/* INVENTORY */
if (cmd==="inventory"){
const user = getStatus(interaction.user.id);

if (!Object.keys(user.inventory).length)
return interaction.editReply("🎒 Vacío");

const list = Object.values(user.inventory)
.map(i=>`${i.icon} ${i.name} x${i.qty}`)
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
.addOptions(Object.values(user.inventory).map(i=>({
label:i.name,
value:i.name,
description:`x${i.qty}`
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

let current = getMemberRank(member);

if (current === rankOrder.length - 1)
return interaction.editReply("🏆 Máximo rango");

const next = current + 1;

if (st.money < rankCosts[next])
return interaction.editReply(`❌ Te faltan ${rankCosts[next]-st.money}`);

st.money -= rankCosts[next];

const role = member.guild.roles.cache.find(r =>
r.name.toLowerCase() === rankOrder[next]
);

if (role) await member.roles.add(role).catch(()=>{});

saveStatus();

return interaction.editReply(`🎖️ Subiste a ${rankOrder[next]}`);
}

return interaction.editReply("⚠️ Comando desconocido");

} catch(e){
console.log(e);

if (interaction.deferred)
return interaction.editReply("❌ Error");

return interaction.reply({ content:"❌ Error", ephemeral:true });
}

});

/* =====================
DROP SYSTEM (PROBABILIDAD + DM)
===================== */
client.on(Events.MessageCreate, async message => {

if (message.author.bot || !message.guild) return;
if (!config.channel) return;
if (message.channel.id !== config.channel) return;

/* PROBABILIDAD DE DROP (10%) */
if (Math.random() > 0.10) return;

const user = getStatus(message.author.id);

const item = rollItem();
if (!item) return;

if (!user.inventory[item.name])
user.inventory[item.name] = { ...item, qty: 0 };

user.inventory[item.name].qty++;

saveStatus();

/* ENVIAR POR DM */
try {
await message.author.send(
`🧭 ¡Encontraste una reliquia!\n${item.icon} ${item.name} x1`
);
} catch {
message.reply("📩 Activa tus DMs para recibir reliquias");
}

});

/* =====================
LOGIN
===================== */
client.login(TOKEN);

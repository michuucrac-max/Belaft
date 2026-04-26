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
app.get("/", (_, res) => res.send("Belaf observa el Abismo 🧭"));
app.listen(PORT, () => console.log(`🌐 Express activo en ${PORT}`));

/* =====================
FILES / CONFIG
===================== */
const configPath = "./config.json";
const statusPath = "./status.json";
const objectsPath = "./objects.json";

const config = fs.existsSync(configPath)
? JSON.parse(fs.readFileSync(configPath, "utf8"))
: { channels: { reliquies: null, tops: null, rankup: null } };

const objects = fs.existsSync(objectsPath)
? JSON.parse(fs.readFileSync(objectsPath, "utf8"))
: { class4: [], class3: [], class2: [], class1: [], special: [], ultra: [] };

const status = fs.existsSync(statusPath)
? JSON.parse(fs.readFileSync(statusPath, "utf8"))
: {};

const saveStatus = () => fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
const saveConfig = () => fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

/* =====================
STATUS FUNCTION
===================== */
function getStatus(id) {
if (!status[id]) status[id] = { money: 0, inventory: {}, lastDrop: 0 };
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
UTILS
===================== */
function normalize(str){
return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}

function getUserRank(member){
const roles = member.roles.cache.map(r => normalize(r.name));

const order = [
"bell",
"silbato rojo",
"silbato azul",
"silbato lunar",
"silbato negro",
"silbato blanco"
];

for(let i = order.length-1; i>=0; i--){
if(roles.some(r => r.includes(order[i]))) return i;
}
return -1;
}

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
o.setName("modo").setDescription("Modo").setRequired(true)
.addChoices({ name: "Uno", value: "one" }, { name: "Todo", value: "all" })
),

new SlashCommandBuilder().setName("rankup").setDescription("Subir rango"),

new SlashCommandBuilder()
.setName("setchannelreliquies")
.setDescription("Canal drops")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("setchanneltops")
.setDescription("Canal tops")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("setchannelrankup")
.setDescription("Canal rankup")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("setmoney")
.setDescription("Dar dinero")
.addUserOption(o=>o.setName("usuario").setRequired(true))
.addNumberOption(o=>o.setName("cantidad").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("removemoney")
.setDescription("Quitar dinero")
.addUserOption(o=>o.setName("usuario").setRequired(true))
.addNumberOption(o=>o.setName("cantidad").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("seemoney")
.setDescription("Ver dinero")
.addUserOption(o=>o.setName("usuario").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("setitem")
.setDescription("Dar objeto")
.addUserOption(o=>o.setName("usuario").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("removeitem")
.setDescription("Quitar objeto")
.addUserOption(o=>o.setName("usuario").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
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
console.log(`🧭 Bot listo como ${client.user.tag}`);

/* TOPS CADA 6H */
setInterval(async () => {
if (!config.channels.tops) return;

const guild = client.guilds.cache.first();
if (!guild) return;

const members = await guild.members.fetch();
const arr = [];

members.forEach(m=>{
if(m.user.bot) return;
const st = getStatus(m.id);
arr.push({ tag: m.user.tag, money: st.money });
});

arr.sort((a,b)=>b.money-a.money);

const medals = ["🥇","🥈","🥉"];

const desc = arr.slice(0,10).map((u,i)=>
`${medals[i]||`#${i+1}`} ${u.tag} — 💰 ${u.money}`
).join("\n");

const embed = new EmbedBuilder()
.setTitle("🏆 TOP Exploradores")
.setDescription(desc);

const ch = guild.channels.cache.get(config.channels.tops);
if(ch) ch.send({ content:"@everyone", embeds:[embed] });

}, 6 * 60 * 60 * 1000);

});

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {
if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isChannelSelectMenu()) return;

/* ===== SET CHANNELS ===== */
if (interaction.isChatInputCommand() && interaction.commandName.startsWith("setchannel")) {

const id = interaction.commandName.replace("setchannel","");

const menu = new ChannelSelectMenuBuilder()
.setCustomId(`set_${id}`)
.addChannelTypes(ChannelType.GuildText)
.setMinValues(1)
.setMaxValues(1);

return interaction.reply({ ephemeral:true, components:[new ActionRowBuilder().addComponents(menu)] });
}

if (interaction.isChannelSelectMenu()) {
const id = interaction.customId.replace("set_","");
config.channels[id] = interaction.values[0];
saveConfig();
return interaction.update({ content:"✅ Canal configurado", components:[] });
}

/* ===== INVENTORY ===== */
if(interaction.commandName==="inventory"){
const user = getStatus(interaction.user.id);

if(!Object.keys(user.inventory).length)
return interaction.reply({ ephemeral:true, content:"🎒 Vacío" });

const list = Object.values(user.inventory)
.map(i=>`${i.icon} ${i.name} x${i.qty}`)
.join("\n");

return interaction.reply({ ephemeral:true, content:`🎒 Inventario\n${list}` });
}

/* ===== MONEY ===== */
if(interaction.commandName==="mymoney"){
const user = getStatus(interaction.user.id);
return interaction.reply({ ephemeral:true, content:`💰 ${user.money}` });
}

/* ===== SELL ===== */
if(interaction.commandName==="sell"){
const user = getStatus(interaction.user.id);
const mode = interaction.options.getString("modo");

if(!Object.keys(user.inventory).length)
return interaction.reply({ ephemeral:true, content:"❌ No tienes objetos" });

if(mode==="all"){
let gain=0;
for(const i of Object.values(user.inventory)){
gain += (i.price||0)*i.qty;
}
user.money+=gain;
user.inventory={};
saveStatus();
return interaction.reply({ ephemeral:true, content:`💰 Ganaste ${gain}` });
}

}

/* ===== ADMIN MONEY ===== */
if(["setmoney","removemoney","seemoney"].includes(interaction.commandName)){
const target = interaction.options.getUser("usuario");
const amount = interaction.options.getNumber("cantidad")||0;
const user = getStatus(target.id);

if(interaction.commandName==="setmoney"){ user.money+=amount; saveStatus(); }
if(interaction.commandName==="removemoney"){ user.money=Math.max(0,user.money-amount); saveStatus(); }

return interaction.reply({ ephemeral:true, content:`💰 ${target.tag}: ${user.money}` });
}

/* ===== RANKUP ===== */
if(interaction.commandName==="rankup"){
const member = interaction.member;
const st = getStatus(member.id);

const order = [
"bell",
"silbato rojo",
"silbato azul",
"silbato lunar",
"silbato negro",
"silbato blanco"
];

const costs = [100,250,500,750,1500,3000];

const current = getUserRank(member);

if(current === order.length-1)
return interaction.reply({ ephemeral:true, content:"Máximo rango" });

const nextName = order[current+1];
const cost = costs[current+1];

if(st.money < cost)
return interaction.reply({ ephemeral:true, content:`Necesitas ${cost}` });

const role = member.guild.roles.cache.find(r => normalize(r.name).includes(nextName));
if(!role) return interaction.reply({ ephemeral:true, content:"Rol no encontrado" });

st.money -= cost;
await member.roles.add(role);

member.roles.cache.forEach(r=>{
if(order.some(o=>normalize(r.name).includes(o)) && normalize(r.name)!==normalize(role.name)){
member.roles.remove(r);
}
});

saveStatus();

/* MENSAJE */
if(config.channels.rankup){
const ch = member.guild.channels.cache.get(config.channels.rankup);
if(ch){
const embed = new EmbedBuilder()
.setTitle("✨ ASCENSO")
.setDescription(`${member} ahora es **${role.name}**`)
.setThumbnail(member.user.displayAvatarURL());
ch.send({ embeds:[embed] });
}
}

return interaction.reply({ ephemeral:true, content:`Subiste a ${role.name}` });
}

});

/* =====================
DROP SYSTEM NUEVO
===================== */
client.on(Events.MessageCreate, async message => {
if(message.author.bot || !message.guild) return;
if(!config.channels.reliquies) return;
if(message.channel.id !== config.channels.reliquies) return;

const user = getStatus(message.author.id);

/* COOLDOWN */
if(Date.now() - user.lastDrop < 4000) return;
user.lastDrop = Date.now();

/* PROBABILIDAD */
if(Math.random() > 0.10) return;

/* CLASE */
const roll = Math.random();
let pool;

if(roll < 0.5) pool = objects.class4;
else if(roll < 0.75) pool = objects.class3;
else if(roll < 0.9) pool = objects.class2;
else if(roll < 0.97) pool = objects.class1;
else if(roll < 0.995) pool = objects.special;
else pool = objects.ultra;

if(!pool.length) return;

const item = pool[Math.floor(Math.random()*pool.length)];

if(!user.inventory[item.name]) user.inventory[item.name] = {...item, qty:0};
user.inventory[item.name].qty++;

saveStatus();

/* DM */
try{
await message.author.send(`🧭 Encontraste ${item.icon} ${item.name}`);
}catch{
message.channel.send(`⚠️ ${message.author} encontró algo pero tiene DMs cerrados`);
}

});

/* =====================
LOGIN
===================== */
client.login(TOKEN);

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
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const PORT = process.env.PORT || 3000;

/* ===================== EXPRESS */
const app = express();
app.get("/", (_, res) => res.send("Nanachi vive"));
app.listen(PORT, () => console.log(`🌐 Express activo en ${PORT}`));

/* ===================== FILES */
const configPath = "./config.json";
const statusPath = "./status.json";
const objectsPath = "./objects.json";

const config = fs.existsSync(configPath)
? JSON.parse(fs.readFileSync(configPath))
: { channels: { drop: null }, ranks: {} };

const objects = fs.existsSync(objectsPath)
? JSON.parse(fs.readFileSync(objectsPath))
: { class4: [], class3: [], class2: [], class1: [], special: [], ultra: [] };

const status = fs.existsSync(statusPath)
? JSON.parse(fs.readFileSync(statusPath))
: {};

const saveStatus = () => fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
const saveConfig = () => fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

function getStatus(id){
if(!status[id]) status[id] = { money:0, inventory:{}, messages:0 };
return status[id];
}

/* ===================== CLIENT */
const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
],
partials:[Partials.Channel]
});

/* ===================== COMMANDS */
const commands = [
new SlashCommandBuilder().setName("setranks").setDescription("Configurar rangos").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
new SlashCommandBuilder().setName("setdrop").setDescription("Canal de drops").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
new SlashCommandBuilder().setName("rankup").setDescription("Subir rango"),
new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario")
];

const rest = new REST({version:"10"}).setToken(TOKEN);

/* ===================== READY */
client.once(Events.ClientReady, async ()=>{
await rest.put(
Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
{body: commands}
);
console.log(`✅ Conectado como ${client.user.tag}`);
});

/* ===================== INTERACTIONS */
client.on(Events.InteractionCreate, async interaction=>{
if(!interaction.isChatInputCommand() && !interaction.isRoleSelectMenu() && !interaction.isChannelSelectMenu()) return;

/* ===== SET RANKS */
if(interaction.commandName==="setranks"){
const menu = new ActionRowBuilder().addComponents(
new StringSelectMenuBuilder()
.setCustomId("ranks")
.setPlaceholder("Selecciona roles en orden")
.setMinValues(1)
.setMaxValues(6)
);
return interaction.reply({content:"Configura rangos manualmente (IDs)", ephemeral:true});
}

/* ===== SET DROP */
if(interaction.commandName==="setdrop"){
const menu = new ChannelSelectMenuBuilder()
.setCustomId("drop")
.addChannelTypes(ChannelType.GuildText)
.setMinValues(1)
.setMaxValues(1);

return interaction.reply({components:[new ActionRowBuilder().addComponents(menu)], ephemeral:true});
}

if(interaction.isChannelSelectMenu() && interaction.customId==="drop"){
config.channels.drop = interaction.values[0];
saveConfig();
return interaction.update({content:"Canal de drop configurado", components:[]});
}

/* ===== RANKUP */
if(interaction.commandName==="rankup"){
const member = interaction.member;
const roles = Object.values(config.ranks);

if(!roles.length) return interaction.reply({content:"Configura rangos primero", ephemeral:true});

let index = roles.findIndex(r=>member.roles.cache.has(r));
index = index === -1 ? 0 : index+1;

if(index>=roles.length) return interaction.reply({content:"Ya tienes el máximo rango", ephemeral:true});

await member.roles.add(roles[index]);
return interaction.reply({content:"Subiste de rango"});
}

});

/* ===================== DROP SYSTEM */
client.on(Events.MessageCreate, message=>{
if(message.author.bot || !message.guild) return;
if(message.channel.id !== config.channels.drop) return;

const user = getStatus(message.author.id);
user.messages++;
saveStatus();

if(user.messages % 10 !== 0) return;

/* probabilidades */
const roll = Math.random();
let pool;

if(roll < 0.5) pool = objects.class4;
else if(roll < 0.75) pool = objects.class3;
else if(roll < 0.9) pool = objects.class2;
else if(roll < 0.97) pool = objects.special;
else pool = objects.ultra;

if(!pool.length) return;

const item = pool[Math.floor(Math.random()*pool.length)];

if(!user.inventory[item.name]) user.inventory[item.name] = {...item, qty:0};
user.inventory[item.name].qty++;

saveStatus();

message.reply({
content:`🧭 Encontraste **${item.name}**`
});
});

/* ===================== LOGIN */
client.login(TOKEN);

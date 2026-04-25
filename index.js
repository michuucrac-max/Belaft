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

/* =====================
RANKS
===================== */
const ranks = {
bell: "1456176950849572979",
silbato_rojo: "1456178133240778763",
silbato_azul: "1456178299364573348",
silbato_lunar: "1456179008625447105",
silbato_negro: "1456178700096635002",
silbato_blanco: "1456179085364695133",
narehate: "1456180289465483396"
};

/* =====================
STATUS
===================== */
function getStatus(id) {
if (!status[id]) status[id] = { money: 0, inventory: {}, messages: 0 };
saveStatus();
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
COMMANDS
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
new SlashCommandBuilder().setName("rankup").setDescription("Subir rango")
];

/* =====================
REGISTER
===================== */
const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once(Events.ClientReady, async () => {
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
console.log(`🧭 Belaf listo como ${client.user.tag}`);
});

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {
if (!interaction.isChatInputCommand()) return;

if (interaction.commandName === "inventory") {
const user = getStatus(interaction.user.id);
if (!Object.keys(user.inventory).length)
return interaction.reply({ content: "🎒 Vacío", ephemeral: true });

const list = Object.values(user.inventory)
.map(i => `${i.icon} ${i.name} x${i.qty}`)
.join("\n");

return interaction.reply({ content: `🎒 Inventario\n${list}`, ephemeral: true });
}

if (interaction.commandName === "mymoney") {
const user = getStatus(interaction.user.id);
return interaction.reply({ content: `💰 ${user.money} monedas`, ephemeral: true });
}

if (interaction.commandName === "rankup") {
const member = interaction.member;
const st = getStatus(member.id);

const roleOrder = ["bell","silbato_rojo","silbato_azul","silbato_lunar","silbato_negro","silbato_blanco"];
const rankCosts = [100,250,500,750,1500,3000];

let currentRoleIndex = -1;

for(let i = roleOrder.length - 1; i >= 0; i--){
if(member.roles.cache.has(ranks[roleOrder[i]])){
currentRoleIndex = i;
break;
}
}

if(currentRoleIndex === roleOrder.length - 1)
return interaction.reply({ content:"✅ Máximo rango", ephemeral:true });

const nextRole = roleOrder[currentRoleIndex + 1];
const cost = rankCosts[currentRoleIndex + 1];

if(st.money < cost)
return interaction.reply({ content:`❌ Necesitas ${cost}`, ephemeral:true });

st.money -= cost;
await member.roles.add(ranks[nextRole]);

saveStatus();

return interaction.reply({ content:`✅ Subiste a ${nextRole}`, ephemeral:true });
}

});

/* =====================
DROP
===================== */
client.on(Events.MessageCreate, message => {
if (message.author.bot || !message.guild) return;

const user = getStatus(message.author.id);
user.messages++;

if (user.messages % 10 !== 0) return;

const pool = objects.class4;
if (!pool.length) return;

const item = pool[Math.floor(Math.random() * pool.length)];

if (!user.inventory[item.name]) user.inventory[item.name] = { ...item, qty: 0 };
user.inventory[item.name].qty++;

saveStatus();

message.reply(`🧭 Encontraste ${item.icon} ${item.name}`);
});

/* =====================
LOGIN
===================== */
client.login(TOKEN);

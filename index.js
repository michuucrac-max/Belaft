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

/* ===================== RANKS ===================== */
const ranks = {
bell: "1456176950849572979",
silbato_rojo: "1456178133240778763",
silbato_azul: "1456178299364573348",
silbato_lunar: "1456179008625447105",
silbato_negro: "1456178700096635002",
silbato_blanco: "1456179085364695133",
narehate: "1456180289465483396"
};

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
o.setName("modo").setDescription("Modo de venta").setRequired(true)
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
.setName("gift")
.setDescription("Regalar artefacto")
.addUserOption(o => o.setName("usuario").setRequired(true)),
new SlashCommandBuilder()
.setName("rankup")
.setDescription("Subir de rango"),
new SlashCommandBuilder()
.setName("setitem")
.setDescription("Dar artefacto")
.addUserOption(o => o.setName("usuario").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
new SlashCommandBuilder()
.setName("removeitem")
.setDescription("Quitar artefacto")
.addUserOption(o => o.setName("usuario").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
new SlashCommandBuilder()
.setName("createartefact")
.setDescription("Crear artefacto")
.addStringOption(o => o.setName("categoria").setRequired(true))
.addStringOption(o => o.setName("nombre").setRequired(true))
.addStringOption(o => o.setName("icono").setRequired(true))
.addNumberOption(o => o.setName("precio").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

/* ===================== REGISTER ===================== */
const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once(Events.ClientReady, async () => {
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
console.log(`🧭 Belaf despierta como ${client.user.tag}`);
});

/* ===================== INTERACTIONS ===================== */
client.on(Events.InteractionCreate, async interaction => {
if (!interaction.isChatInputCommand()) return;

const user = getStatus(interaction.user.id);

if (interaction.commandName === "inventory") {
if (!Object.keys(user.inventory).length)
return interaction.reply({ content: "🎒 Vacío.", ephemeral: true });

const list = Object.values(user.inventory)
.map(i => `${i.icon} ${i.name} x${i.qty}`)
.join("\n");

return interaction.reply({ content: `🎒 Inventario\n${list}`, ephemeral: true });
}

if (interaction.commandName === "mymoney") {
return interaction.reply({ content: `💰 ${user.money} monedas`, ephemeral: true });
}

if (interaction.commandName === "rankup") {
const member = interaction.member;

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
return interaction.reply({ content:"✅ Ya tienes el máximo rango", ephemeral:true });

const nextRole = roleOrder[currentRoleIndex + 1];
const cost = rankCosts[currentRoleIndex + 1];

if(user.money < cost)
return interaction.reply({ content:`❌ Necesitas ${cost} monedas`, ephemeral:true });

user.money -= cost;
await member.roles.add(ranks[nextRole]);
saveStatus();

return interaction.reply({ content:`✅ Subiste a ${nextRole}`, ephemeral:true });
}

});

/* ===================== LOGIN ===================== */
client.login(TOKEN);

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

/* ===================== ROLES ===================== */
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
o.setName("modo")
.setDescription("Modo de venta")
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
.setDescription("Crear artefacto")
.addStringOption(o => o.setName("categoria").setRequired(true))
.addStringOption(o => o.setName("nombre").setRequired(true))
.addStringOption(o => o.setName("icono").setRequired(true))
.addNumberOption(o => o.setName("precio").setRequired(true))
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

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
const topUsers = [];

members.forEach(m => {
if (m.user.bot) return;
const st = getStatus(m.id);
topUsers.push({ tag: m.user.tag, money: st.money });
});

topUsers.sort((a, b) => b.money - a.money);
const top10 = topUsers.slice(0, 10);

const embed = new EmbedBuilder()
.setTitle("🏆 TOP Exploradores")
.setDescription(
top10.map((u, i) => `**${i + 1}.** ${u.tag} — 💰 ${u.money}`).join("\n")
)
.setFooter({ text: "Gaburon supervisa los tops" });

const ch = guild.channels.cache.get(config.channels.tops);
if (ch) await ch.send({ embeds: [embed], content: "@everyone @here" });

}, 720 * 60 * 1000);
});

/* ===================== INTERACTIONS ===================== */
client.on(Events.InteractionCreate, async interaction => {

if (
!interaction.isChatInputCommand() &&
!interaction.isStringSelectMenu() &&
!interaction.isChannelSelectMenu()
) return;

/* ===================== INVENTORY ===================== */
if (interaction.commandName === "inventory") {
const user = getStatus(interaction.user.id);

if (!Object.keys(user.inventory).length)
return interaction.reply({ ephemeral: true, content: "🎒 Vacío." });

const list = Object.values(user.inventory)
.map(i => `${i.icon} ${i.name} x${i.qty}`)
.join("\n");

return interaction.reply({
ephemeral: true,
content: `🎒 Inventario\n${list}`
});
}

/* ===================== MONEY ===================== */
if (interaction.commandName === "mymoney") {
const user = getStatus(interaction.user.id);

return interaction.reply({
ephemeral: true,
content: `💰 ${user.money} monedas`
});
}

/* ===================== RANKUP (SIN BELL) ===================== */
if (interaction.commandName === "rankup") {
const member = interaction.member;
const user = getStatus(member.id);

const roleOrder = [
"silbato_rojo",
"silbato_azul",
"silbato_lunar",
"silbato_negro",
"silbato_blanco"
];

const costs = [100, 250, 500, 750, 1500];

let index = -1;

for (let i = roleOrder.length - 1; i >= 0; i--) {
const role = interaction.guild.roles.cache.get(ranks[roleOrder[i]]);
if (role && member.roles.cache.has(role.id)) {
index = i;
break;
}
}

if (index === roleOrder.length - 1)
return interaction.reply({ ephemeral: true, content: "✅ Máximo rango alcanzado" });

const next = roleOrder[index + 1];
const cost = costs[index + 1];

if (user.money < cost)
return interaction.reply({ ephemeral: true, content: `❌ Necesitas ${cost} monedas` });

user.money -= cost;

const nextRole = interaction.guild.roles.cache.get(ranks[next]);
await member.roles.add(nextRole);

saveStatus();

return interaction.reply({
ephemeral: true,
content: `🎖️ Subiste a ${next}`
});
}

/* ===================== DROP SYSTEM (DM + FALLBACK) ===================== */
client.on(Events.MessageCreate, async message => {
if (message.author.bot || !message.guild) return;
if (!config.channels.reliquies.includes(message.channel.id)) return;

if (Math.random() > 0.15) return;

const pool = objects.class4.concat(objects.class3, objects.class2, objects.special);
if (!pool.length) return;

const item = pool[Math.floor(Math.random() * pool.length)];
const user = getStatus(message.author.id);

if (!user.inventory[item.name]) {
user.inventory[item.name] = { ...item, qty: 0 };
}
user.inventory[item.name].qty++;

saveStatus();

try {
await message.author.send(
`🧭 Has encontrado:\n**${item.icon} ${item.name} x1**`
);
} catch {
message.channel.send(
`🧭 ${message.author}, encontraste **${item.icon} ${item.name} x1**`
);
}
});

/* ===================== LOGIN ===================== */
client.login(TOKEN);

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
app.get("/", (_, res) => res.send("Belaf observa el Abismo 🧭"));
app.listen(PORT);

/* =====================
CLIENT
===================== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

/* =====================
FILES
===================== */
const configPath = "./config.json";
const usersPath = "./users.json";
const objectsPath = "./objects.json";

const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, "utf8"))
  : { channels: { reliquies: [], trade: null, sell: null, tops: null } };

const objects = JSON.parse(fs.readFileSync(objectsPath, "utf8"));

const users = fs.existsSync(usersPath)
  ? JSON.parse(fs.readFileSync(usersPath, "utf8"))
  : {};

const saveUsers = () =>
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

const saveConfig = () =>
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

/* =====================
HELPERS (ROLES REALES)
===================== */
function getDisplayRole(member) {
  if (!member) return "sin-rol";
  const roles = member.roles.cache
    .filter(r => r.name !== "@everyone")
    .sort((a, b) => b.position - a.position);
  return roles.first()?.name ?? "sin-rol";
}

function isNarehate(member) {
  if (!member) return false;
  return member.roles.cache.some(r =>
    r.name.toLowerCase().includes("narehate")
  );
}

/* =====================
USER MANAGEMENT
===================== */
function getUser(id, guildMember = null) {
  if (!users[id]) {
    users[id] = {
      money: 0,
      rank: "bell",
      humanity: true,
      inventory: {},
      messages: 0
    };
  }

  if (guildMember) {
    const roleOrder = [
      "bell",
      "silbato_rojo",
      "silbato_azul",
      "silbato_lunar",
      "silbato_negro",
      "silbato_blanco",
      "narehate"
    ];
    const memberRoles = guildMember.roles.cache.map(r => r.name);
    const matchedRole = roleOrder.reverse().find(r =>
      memberRoles.includes(r)
    );
    if (matchedRole) users[id].rank = matchedRole;
  }

  updateHumanity(users[id]);
  saveUsers();
  return users[id];
}

function updateHumanity(user) {
  const narehateRanks = [
    "silbato_rojo",
    "silbato_azul",
    "silbato_lunar",
    "silbato_negro",
    "silbato_blanco",
    "narehate"
  ];
  user.humanity = !narehateRanks.includes(user.rank);
}

/* =====================
DROP SYSTEM
===================== */
client.on(Events.MessageCreate, message => {
  if (message.author.bot || !message.guild) return;
  if (!config.channels.reliquies.includes(message.channel.id)) return;

  const depth = config.channels.reliquies.indexOf(message.channel.id);
  const user = getUser(message.author.id, message.member);
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
  saveUsers();

  message.reply(`🧭 Encontraste ${item.icon} ${item.name}`);
});

/* =====================
SLASH COMMANDS
===================== */
const commands = [
  new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),
  new SlashCommandBuilder().setName("rankup").setDescription("Subir de rango"),
  new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Vender reliquias")
    .addStringOption(o =>
      o.setName("mode").setRequired(true).addChoices(
        { name: "Uno", value: "one" },
        { name: "Todo", value: "all" }
      )
    ),
  new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Intercambiar reliquias")
    .addUserOption(o =>
      o.setName("user").setRequired(true)
    ),
  new SlashCommandBuilder().setName("setchannelreliquies").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder().setName("setchanneltrade").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder().setName("setchannelsell").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder().setName("setchanneltops").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("🧭 Belaf despierta");

  setInterval(() => {
    if (!config.channels.tops) return;
    const channel = client.channels.cache.get(config.channels.tops);
    if (!channel) return;

    const topMoney = Object.entries(users)
      .sort(([, a], [, b]) => b.money - a.money)
      .slice(0, 5)
      .map(([id, u], i) => {
        const member = channel.guild.members.cache.get(id);
        return `#${i + 1} <@${id}> [${getDisplayRole(member)}] — ${u.money} 💰`;
      })
      .join("\n");

    const topRelics = Object.entries(users)
      .map(([id, u]) => ({
        id,
        total: Object.values(u.inventory || {}).reduce((s, o) => s + o.qty, 0)
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((u, i) => {
        const member = channel.guild.members.cache.get(u.id);
        return `#${i + 1} <@${u.id}> [${getDisplayRole(member)}] — ${u.total} reliquias`;
      })
      .join("\n");

    channel.send({
  content: `🏆 TOP EXPLORADORES 🏆

💰 **Top Dinero**
${topMoney || "Sin datos"}

🎒 **Top Reliquias**
${topRelics || "Sin datos"}`
});

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isChannelSelectMenu()) return;

  const user = getUser(interaction.user.id, interaction.member);

  if (interaction.isChatInputCommand() && interaction.commandName === "trade") {
    if (interaction.channelId !== config.channels.trade)
      return interaction.reply({ ephemeral: true, content: "❌ Canal incorrecto." });

    const targetUser = interaction.options.getUser("user");
    const targetMember = interaction.guild.members.cache.get(targetUser.id);

    const userIsNarehate = isNarehate(interaction.member);
    const targetIsNarehate = isNarehate(targetMember);

    if (!userIsNarehate && !targetIsNarehate)
      return interaction.reply({ ephemeral: true, content: "❌ Humanos no pueden tradear entre sí." });

    return interaction.reply({ ephemeral: true, content: "🔁 Trade permitido." });
  }
});

client.login(TOKEN);

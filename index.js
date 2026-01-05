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

const objects = JSON.parse(fs.readFileSync(objectsPath, "utf8"));

const status = fs.existsSync(statusPath)
  ? JSON.parse(fs.readFileSync(statusPath, "utf8"))
  : {};

const saveStatus = () =>
  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));

const saveConfig = () =>
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

/* =====================
RANGOS POR ID (OFICIAL)
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
RANGO REAL DISCORD
===================== */
function getDiscordRank(member) {
  if (!member) return "Sin rango";

  if (member.roles.cache.has(NAREHATE_ROLE_ID)) {
    return "Narehate";
  }

  for (let i = RANK_ROLES.length - 1; i >= 0; i--) {
    if (member.roles.cache.has(RANK_ROLES[i].id)) {
      return RANK_ROLES[i].name;
    }
  }

  return "Sin rango";
}

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
    status[id].rank = getDiscordRank(member);
    status[id].humanity = !member.roles.cache.has(NAREHATE_ROLE_ID);
  }

  saveStatus();
  return status[id];
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
      o.setName("mode").setDescription("Modo").setRequired(true)
        .addChoices({ name: "Uno", value: "one" }, { name: "Todo", value: "all" })
    ),
  new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Intercambiar reliquias")
    .addUserOption(o => o.setName("user").setDescription("Usuario").setRequired(true)),
  new SlashCommandBuilder().setName("setchannelreliquies").setDescription("Drops").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder().setName("setchanneltrade").setDescription("Trade").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder().setName("setchannelsell").setDescription("Sell").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder().setName("setchanneltops").setDescription("Tops").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isChannelSelectMenu() && !interaction.isStringSelectMenu()) return;

  const user = getStatus(interaction.user.id, interaction.member);

  /* ===== RANKUP ===== */
  if (interaction.commandName === "rankup") {
    if (!user.humanity) {
      return interaction.reply({
        ephemeral: true,
        content: "❌ No puedes ascender.\n🧬 Se necesita **humanidad** para subir de rango."
      });
    }
    return interaction.reply({ ephemeral: true, content: "✅ Rankup permitido (lógica intacta)." });
  }

  /* ===== TRADE ===== */
  if (interaction.commandName === "trade") {
    const targetUser = interaction.options.getUser("user");
    const target = getStatus(targetUser.id, await interaction.guild.members.fetch(targetUser.id));

    if (user.humanity && target.humanity) {
      return interaction.reply({
        ephemeral: true,
        content: "❌ Humanos no pueden tradear entre sí."
      });
    }

    return interaction.reply({ ephemeral: true, content: "🔁 Trade permitido." });
  }
});

/* =====================
TOP EXPLORADORES
===================== */
async function sendTopExploradores() {
  if (!config.channels.tops) return;
  const channel = await client.channels.fetch(config.channels.tops).catch(() => null);
  if (!channel) return;

  const data = [];

  for (const [id, u] of Object.entries(status)) {
    let member = null;
    try { member = await channel.guild.members.fetch(id); } catch {}
    const items = Object.values(u.inventory ?? {}).reduce((a, b) => a + b.qty, 0);

    data.push({
      tag: member ? member.user.tag : "Usuario salido",
      rank: getDiscordRank(member),
      money: u.money,
      items
    });
  }

  const top = data.sort((a, b) => b.money - a.money).slice(0, 10);

  const text = top.map((u, i) =>
    `**${i + 1}. ${u.tag}**\n🧭 Rango: **${u.rank}**\n💰 Dinero: **${u.money}**\n🎒 Objetos: **${u.items}**`
  ).join("\n\n");

  channel.send(`🏆 **TOP EXPLORADORES** 🏆\n\n${text}`);
}

setInterval(sendTopExploradores, 10 * 60 * 1000);

/* =====================
SAFE SAVE
===================== */
process.on("SIGINT", () => { saveStatus(); process.exit(); });
process.on("SIGTERM", () => { saveStatus(); process.exit(); });
process.on("uncaughtException", err => {
  console.error(err);
  saveStatus();
  process.exit(1);
});

client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("🧭 Belaf despierta");
});

client.login(TOKEN);

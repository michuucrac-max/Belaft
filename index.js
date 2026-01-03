import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType
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
   EXPRESS (keep alive)
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
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

/* =====================
   FILES
===================== */
let config = JSON.parse(fs.readFileSync("config.json", "utf8"));
const objects = JSON.parse(fs.readFileSync("objects.json", "utf8"));

let users = fs.existsSync("users.json")
  ? JSON.parse(fs.readFileSync("users.json", "utf8"))
  : {};

const saveUsers = () =>
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));

const saveConfig = () =>
  fs.writeFileSync("config.json", JSON.stringify(config, null, 2));

/* =====================
   HELPERS
===================== */
function getUser(id) {
  if (!users[id]) {
    users[id] = { money: 0, inventory: {}, messages: 0 };
    saveUsers();
  }
  return users[id];
}

function isNarehate(member) {
  return member.roles.cache.has(config.roles.narehate);
}

function getRankFromRoles(member) {
  for (const rank of config.ranks) {
    const roleId = config.roles[rank];
    if (roleId && member.roles.cache.has(roleId)) {
      return rank;
    }
  }
  return "bell";
}

/* =====================
   DROP SYSTEM (7 CANALES)
===================== */
client.on(Events.MessageCreate, message => {
  if (message.author.bot || !message.guild) return;
  if (!config.channels.find?.includes(message.channel.id)) return;

  const user = getUser(message.author.id);
  user.messages++;

  if (user.messages % 5 !== 0) return saveUsers();

  const index = config.channels.find.indexOf(message.channel.id);

  const pools = [
    objects.class4,
    objects.class3,
    objects.class2,
    objects.class1,
    objects.special,
    objects.special,
    objects.ilblu
  ];

  let chance = index === 6 ? 0.067 : 1;

  if (isNarehate(message.member)) {
    chance += index === 6 ? 0.067 : 0.056;
  }

  if (Math.random() > chance) return;

  const pool = pools[index];
  if (!pool?.length) return;

  const raw = pool[Math.floor(Math.random() * pool.length)];

  user.inventory[raw.name] ??= {
    name: raw.name,
    icon: raw.icon,
    qty: 0
  };

  user.inventory[raw.name].qty++;
  saveUsers();

  message.reply(
    index === 6
      ? `🏛️ **Ilblu susurra:** obtuviste ${raw.icon} **${raw.name}**`
      : `🧭 **Belaf murmura:** encontraste ${raw.icon} **${raw.name}**`
  );
});

/* =====================
   SLASH COMMANDS
===================== */
const commands = [
  new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),
  new SlashCommandBuilder().setName("trade").setDescription("Intercambiar"),
  new SlashCommandBuilder().setName("rankup").setDescription("Subir de rango"),

  new SlashCommandBuilder().setName("setchannelreliquies").setDescription("Canales de reliquias").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchannelsell").setDescription("Canal ventas").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchanneltrade").setDescription("Canal trade").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchanneltops").setDescription("Canal tops").setDefaultMemberPermissions(0)
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* =====================
   READY
===================== */
client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("🧭 Belaf despierta");
});

/* =====================
   INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {

  /* ===== SET CHANNELS ===== */
  if (interaction.isChatInputCommand() &&
      interaction.commandName.startsWith("setchannel")) {

    const key = interaction.commandName
      .replace("setchannel", "")
      .replace("reliquies", "find");

    const multi = key === "find";

    const menu = new ChannelSelectMenuBuilder()
      .setCustomId(`set_${key}`)
      .setPlaceholder("Selecciona canal(es)")
      .setMinValues(1)
      .setMaxValues(multi ? 7 : 1)
      .addChannelTypes(ChannelType.GuildText);

    return interaction.reply({
      content: "🧭 Selecciona el canal",
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true
    });
  }

  /* ===== CHANNEL SELECT ===== */
  if (interaction.isChannelSelectMenu()) {
    const key = interaction.customId.replace("set_", "");

    if (key === "find") {
      config.channels.find = interaction.values;
    } else {
      config.channels[key] = interaction.values[0];
    }

    saveConfig();

    return interaction.reply({
      content: `✅ Canal configurado para **${key}**`,
      ephemeral: true
    });
  }

  /* ===== RANKUP ===== */
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "rankup") return;

  const user = getUser(interaction.user.id);
  const member = interaction.member;

  if (isNarehate(member)) {
    return interaction.reply({
      content: "🧬 Como **Narehate**, ya no puedes subir de silbato.",
      ephemeral: true
    });
  }

  const current = getRankFromRoles(member);
  const next = config.ranks[config.ranks.indexOf(current) + 1];

  if (!next) {
    return interaction.reply({
      content: "❌ Ya estás en el rango máximo.",
      ephemeral: true
    });
  }

  const req = config.rankRequirements[next];

  if (user.money < req.money) {
    return interaction.reply({
      content: `💰 Necesitas **${req.money} monedas**.`,
      ephemeral: true
    });
  }

  if (!user.inventory[req.item]) {
    return interaction.reply({
      content: `🎒 Necesitas **${req.item}**.`,
      ephemeral: true
    });
  }

  user.money -= req.money;
  user.inventory[req.item].qty--;
  if (user.inventory[req.item].qty <= 0) delete user.inventory[req.item];

  await member.roles.remove(config.roles[current]);
  await member.roles.add(config.roles[next]);

  saveUsers();

  interaction.reply({
    content: `🎖️ Has ascendido a **${next.toUpperCase()}**`
  });
});

client.login(TOKEN);

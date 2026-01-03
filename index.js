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
let config = fs.existsSync("config.json")
  ? JSON.parse(fs.readFileSync("config.json", "utf8"))
  : { channels: { reliquies: [], trade: null, sell: null, tops: null } };

const objects = JSON.parse(fs.readFileSync("objects.json", "utf8"));

let users = fs.existsSync("users.json")
  ? JSON.parse(fs.readFileSync("users.json", "utf8"))
  : {};

const saveUsers = () =>
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));

const saveConfig = () =>
  fs.writeFileSync("config.json", JSON.stringify(config, null, 2));

function getUser(id) {
  if (!users[id]) {
    users[id] = {
      money: 0,
      rank: "bell",
      humanity: true,
      inventory: {},
      messages: 0
    };
    saveUsers();
  }
  return users[id];
}

/* =====================
DROP SYSTEM (6 CANALES)
===================== */
client.on(Events.MessageCreate, message => {
  if (message.author.bot || !message.guild) return;
  if (!Array.isArray(config.channels.reliquies)) return;
  if (!config.channels.reliquies.includes(message.channel.id)) return;

  const depth = config.channels.reliquies.indexOf(message.channel.id);
  const user = getUser(message.author.id);
  user.messages++;

  if (user.messages % 5 !== 0) return;

  const pools = [
    objects.class4,
    objects.class3,
    objects.class2,
    objects.class1,
    objects.special,
    objects.special
  ];

  let item;
  if (depth === 5 && Math.random() < 0.000001) {
    item = objects.ultra[0];
    message.channel.send(
      `@everyone 🌑 **${message.author.username} obtuvo ${item.icon} ${item.name}**`
    );
  } else {
    const pool = pools[depth] || objects.class4;
    item = pool[Math.floor(Math.random() * pool.length)];
  }

  user.inventory[item.name] ??= { ...item, qty: 0 };
  user.inventory[item.name].qty++;

  saveUsers();
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
      o.setName("mode")
        .setDescription("Cómo vender")
        .setRequired(true)
        .addChoices(
          { name: "Uno", value: "one" },
          { name: "Todo", value: "all" }
        )
    ),

  new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Intercambiar reliquias")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Usuario")
        .setRequired(true)
    ),

  // SET CHANNELS (ANTIGUOS, FUNCIONALES)
  new SlashCommandBuilder()
    .setName("setchannelreliquies")
    .setDescription("Configurar canales de reliquias")
    .setDefaultMemberPermissions(0),

  new SlashCommandBuilder()
    .setName("setchanneltrade")
    .setDescription("Configurar canal de trade")
    .setDefaultMemberPermissions(0),

  new SlashCommandBuilder()
    .setName("setchannelsell")
    .setDescription("Configurar canal de venta")
    .setDefaultMemberPermissions(0),

  new SlashCommandBuilder()
    .setName("setchanneltops")
    .setDescription("Configurar canal de tops")
    .setDefaultMemberPermissions(0)
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("🧭 Belaf despierta");
});

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {

  /* ===== CHANNEL SELECT ===== */
  if (interaction.isChannelSelectMenu()) {
    if (interaction.customId === "reliquies") {
      config.channels.reliquies = interaction.values;
    }
    if (interaction.customId === "trade") {
      config.channels.trade = interaction.values[0];
    }
    if (interaction.customId === "sell") {
      config.channels.sell = interaction.values[0];
    }
    if (interaction.customId === "tops") {
      config.channels.tops = interaction.values[0];
    }

    saveConfig();
    return interaction.update({
      content: "📜 Canal(es) guardado(s).",
      components: []
    });
  }

  /* ===== SETCHANNEL CMDS ===== */
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName.startsWith("setchannel")) {
      await interaction.deferReply({ ephemeral: true });

      const isReliquies = interaction.commandName === "setchannelreliquies";

      const menu = new ChannelSelectMenuBuilder()
        .setCustomId(
          interaction.commandName.replace("setchannel", "")
        )
        .setPlaceholder("Selecciona canal(es)")
        .addChannelTypes(ChannelType.GuildText);

      if (isReliquies) {
        menu.setMinValues(1).setMaxValues(6);
      }

      return interaction.editReply({
        content: "📜 Selecciona:",
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    }
  }
});

client.login(TOKEN);

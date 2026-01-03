import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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

if (!TOKEN || !CLIENT_ID) {
  console.error("❌ Faltan variables de entorno");
  process.exit(1);
}

/* =====================
EXPRESS 24/7
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
USER INIT
===================== */
function getUser(id) {
  if (!users[id]) {
    users[id] = {
      money: 0,
      rank: "bell",
      inventory: {},
      messages: 0
    };
    saveUsers();
  }
  return users[id];
}

/* =====================
DROP SYSTEM
===================== */
client.on(Events.MessageCreate, message => {
  if (message.author.bot || !message.guild) return;
  if (!config.channels?.reliquies?.includes(message.channel.id)) return;

  const user = getUser(message.author.id);
  user.messages++;

  if (user.messages % 5 !== 0) {
    saveUsers();
    return;
  }

  const index = config.channels.reliquies.indexOf(message.channel.id);

  const pools = [
    objects.class4,
    objects.class3,
    objects.class2,
    objects.class1,
    objects.special,
    objects.special
  ];

  let item;

  if (Math.random() <= 0.000001) {
    item = objects.ultra[0];
    message.channel.send(
      `@everyone 🌑 **EL ABISMO HA RESPONDIDO** 🌑\n` +
      `**${message.author.username}** obtuvo **${item.icon} ${item.name}**`
    );
  } else {
    const pool = pools[index] || objects.class4;
    item = pool[Math.floor(Math.random() * pool.length)];
  }

  user.inventory[item.name] ??= {
    name: item.name,
    icon: item.icon,
    qty: 0
  };

  user.inventory[item.name].qty++;
  saveUsers();

  message.reply(`🧭 **Belaf murmura:** encontraste **${item.icon} ${item.name}**`);
});

/* =====================
SLASH COMMANDS
===================== */
const commands = [
  new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver tus monedas"),
  new SlashCommandBuilder().setName("rankup").setDescription("Ascender de rango"),

  new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Intercambiar reliquias")
    .addUserOption(o => o.setName("user").setDescription("Usuario").setRequired(true))
    .addStringOption(o => o.setName("item").setDescription("Objeto").setRequired(true)),

  new SlashCommandBuilder().setName("setchannelreliquies").setDescription("Canales reliquias").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchanneltrade").setDescription("Canal trade").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchannelsell").setDescription("Canal venta").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchanneltops").setDescription("Canal tops").setDefaultMemberPermissions(0),
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

  /* =====================
  CHANNEL SELECT MENU
  ===================== */
  if (interaction.isChannelSelectMenu()) {
    config.channels ??= {
      reliquies: [],
      trade: null,
      sell: null,
      tops: null
    };

    if (interaction.customId === "reliquies")
      config.channels.reliquies = interaction.values;

    if (interaction.customId === "trade")
      config.channels.trade = interaction.values[0];

    if (interaction.customId === "sell")
      config.channels.sell = interaction.values[0];

    if (interaction.customId === "tops")
      config.channels.tops = interaction.values[0];

    saveConfig();

    return interaction.update({
      content: "📜 Canal registrado correctamente.",
      components: []
    });
  }

  /* =====================
  SLASH COMMANDS
  ===================== */
  if (!interaction.isChatInputCommand()) return;

  const user = getUser(interaction.user.id);

  /* ===== INVENTORY ===== */
  if (interaction.commandName === "inventory") {
    const items = Object.values(user.inventory);
    if (!items.length)
      return interaction.reply({ content: "🎒 Inventario vacío.", ephemeral: true });

    return interaction.reply({
      content: items.map(i => `${i.icon} **${i.name}** x${i.qty}`).join("\n"),
      ephemeral: true
    });
  }

  /* ===== MONEY ===== */
  if (interaction.commandName === "mymoney") {
    return interaction.reply({
      content: `💰 Tienes **${user.money}** monedas`,
      ephemeral: true
    });
  }

  /* ===== TRADE ===== */
  if (interaction.commandName === "trade") {
    if (interaction.channelId !== config.channels.trade)
      return interaction.reply({
        content: "❌ Este no es el canal de trade.",
        ephemeral: true
      });

    const target = interaction.options.getUser("user");
    const itemName = interaction.options.getString("item");

    if (!user.inventory[itemName] || user.inventory[itemName].qty < 1)
      return interaction.reply({
        content: "🎒 No tienes ese objeto.",
        ephemeral: true
      });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`trade_accept_${interaction.user.id}_${target.id}_${itemName}`)
        .setLabel("Aceptar trade")
        .setStyle(ButtonStyle.Success)
    );

    return interaction.reply({
      content: `🔁 **${target.username}**, ${interaction.user.username} te ofrece **${itemName}**`,
      components: [row]
    });
  }

  /* =====================
  SET CHANNEL COMMANDS
  ===================== */
  if (
    interaction.commandName.startsWith("setchannel")
  ) {
    await interaction.deferReply({ ephemeral: true });

    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(
          interaction.commandName.replace("setchannel", "")
        )
        .setPlaceholder("Selecciona el canal")
        .addChannelTypes(ChannelType.GuildText)
    );

    return interaction.editReply({
      content: "📜 Selecciona el canal:",
      components: [row]
    });
  }
});

client.login(TOKEN);

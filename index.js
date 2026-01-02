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
  ChannelType,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
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

const pendingTrades = new Map();

const saveUsers = () =>
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));

const saveConfig = () =>
  fs.writeFileSync("config.json", JSON.stringify(config, null, 2));

/* =====================
   USERS
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

function isNarehate(member) {
  return member.roles.cache.has(config.roles.narehate);
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

  let chance = 1;
  if (index === 6) chance = 0.067;

  const member = message.guild.members.cache.get(message.author.id);
  if (isNarehate(member)) chance += 0.067;

  if (Math.random() > chance) return;

  const pool = pools[index];
  if (!pool?.length) return;

  const item = pool[Math.floor(Math.random() * pool.length)];

  user.inventory[item.name] ??= {
    name: item.name,
    icon: item.icon,
    qty: 0
  };
  user.inventory[item.name].qty++;

  saveUsers();
  message.reply(
    index === 6
      ? `🏛️ **Ilblu susurra:** obtuviste **${item.icon} ${item.name}**`
      : `🧭 **Belaf murmura:** encontraste **${item.icon} ${item.name}**`
  );
});

/* =====================
   SLASH COMMANDS
===================== */
const commands = [
  new SlashCommandBuilder().setName("inventory").setDescription("Ver tu inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver tus monedas"),
  new SlashCommandBuilder().setName("trade").setDescription("Tradear con un Narehate"),

  new SlashCommandBuilder()
    .setName("setchannelreliquies")
    .setDescription("Configurar canales de reliquias")
    .setDefaultMemberPermissions(0),

  new SlashCommandBuilder()
    .setName("setchanneltops")
    .setDescription("Configurar canal de tops")
    .setDefaultMemberPermissions(0),

  new SlashCommandBuilder()
    .setName("setchanneltrade")
    .setDescription("Configurar canal de trade")
    .setDefaultMemberPermissions(0),

  new SlashCommandBuilder()
    .setName("setchannelsell")
    .setDescription("Configurar canal de ventas")
    .setDefaultMemberPermissions(0)
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

  /* ================= INVENTORY ================= */
  if (interaction.isChatInputCommand()) {
    const user = getUser(interaction.user.id);

    if (interaction.commandName === "inventory") {
      const items = Object.values(user.inventory);
      if (!items.length)
        return interaction.reply({ content: "🎒 Inventario vacío", ephemeral: true });

      return interaction.reply({
        content: items.map(i => `${i.icon} **${i.name}** x${i.qty}`).join("\n"),
        ephemeral: true
      });
    }

    if (interaction.commandName === "mymoney") {
      return interaction.reply({
        content: `💰 Tienes **${user.money}** monedas`,
        ephemeral: true
      });
    }
  }

  /* ================= CONFIG CHANNELS ================= */
  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === "setchannelreliquies") {
      const row = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("set_reliquies")
          .setMinValues(7)
          .setMaxValues(7)
          .setChannelTypes(ChannelType.GuildText)
          .setPlaceholder("Bell → Rojo → Azul → Lunar → Negro → Blanco → Ilblu")
      );

      return interaction.reply({
        content: "🧭 Selecciona los **7 canales** de reliquias (orden importa)",
        components: [row],
        ephemeral: true
      });
    }

    if (interaction.commandName === "setchanneltops") {
      const row = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("set_tops")
          .setMinValues(1)
          .setMaxValues(1)
          .setChannelTypes(ChannelType.GuildText)
      );

      return interaction.reply({
        content: "🏆 Selecciona el canal de tops",
        components: [row],
        ephemeral: true
      });
    }

    if (interaction.commandName === "setchanneltrade") {
      const row = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("set_trade")
          .setMinValues(1)
          .setMaxValues(1)
          .setChannelTypes(ChannelType.GuildText)
      );

      return interaction.reply({
        content: "🔁 Selecciona el canal de trade",
        components: [row],
        ephemeral: true
      });
    }

    if (interaction.commandName === "setchannelsell") {
      const row = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("set_sell")
          .setMinValues(1)
          .setMaxValues(1)
          .setChannelTypes(ChannelType.GuildText)
      );

      return interaction.reply({
        content: "💰 Selecciona el canal de ventas",
        components: [row],
        ephemeral: true
      });
    }
  }

  /* ================= SELECT MENUS ================= */
  if (interaction.isChannelSelectMenu()) {
    if (interaction.customId === "set_reliquies")
      config.channels.find = interaction.values;

    if (interaction.customId === "set_tops")
      config.channels.tops = interaction.values[0];

    if (interaction.customId === "set_trade")
      config.channels.trade = interaction.values[0];

    if (interaction.customId === "set_sell")
      config.channels.sell = interaction.values[0];

    saveConfig();
    return interaction.update({
      content: "✅ Configuración guardada",
      components: []
    });
  }

  /* ================= TRADE ================= */
  if (interaction.isChatInputCommand() && interaction.commandName === "trade") {
    const user = getUser(interaction.user.id);
    const items = Object.values(user.inventory);

    if (!items.length)
      return interaction.reply({ content: "🎒 No tienes objetos", ephemeral: true });

    const row1 = new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId("trade_user")
        .setPlaceholder("Selecciona un Narehate")
    );

    const row2 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("trade_item")
        .setPlaceholder("Objeto a ofrecer")
        .addOptions(items.map(i => ({
          label: i.name,
          value: i.name,
          description: `x${i.qty}`
        })))
    );

    return interaction.reply({
      content: "🔁 Configura el trade",
      components: [row1, row2],
      ephemeral: true
    });
  }

  if (interaction.isUserSelectMenu() && interaction.customId === "trade_user") {
    pendingTrades.set(interaction.user.id, { target: interaction.values[0] });
    return interaction.update({ content: "👤 Usuario seleccionado", components: interaction.message.components });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "trade_item") {
    const trade = pendingTrades.get(interaction.user.id);
    trade.offer = interaction.values[0];

    const target = await interaction.guild.members.fetch(trade.target);
    if (!isNarehate(target))
      return interaction.reply({ content: "❌ Solo con Narehates", ephemeral: true });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("trade_accept").setLabel("Aceptar").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("trade_reject").setLabel("Rechazar").setStyle(ButtonStyle.Danger)
    );

    await target.send({
      content:
`🔁 **Solicitud de Trade**
${interaction.user.username} ofrece **${trade.offer}**

¿Aceptas?`,
      components: [buttons]
    });

    return interaction.update({ content: "📩 Trade enviado", components: [] });
  }

  if (interaction.isButton()) {
    const entry = [...pendingTrades.entries()].find(([_, v]) =>
      v.target === interaction.user.id
    );
    if (!entry) return;

    const [fromId, data] = entry;
    const fromUser = getUser(fromId);
    const toUser = getUser(interaction.user.id);

    if (interaction.customId === "trade_accept") {
      fromUser.inventory[data.offer].qty--;
      if (fromUser.inventory[data.offer].qty <= 0)
        delete fromUser.inventory[data.offer];

      toUser.inventory[data.offer] ??= { name: data.offer, icon: "📦", qty: 0 };
      toUser.inventory[data.offer].qty++;

      saveUsers();
      pendingTrades.delete(fromId);
      return interaction.reply("✅ Trade aceptado");
    }

    if (interaction.customId === "trade_reject") {
      pendingTrades.delete(fromId);
      return interaction.reply("❌ Trade rechazado");
    }
  }
});

client.login(TOKEN);

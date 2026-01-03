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
let config = fs.existsSync("config.json")
  ? JSON.parse(fs.readFileSync("config.json", "utf8"))
  : { channels: {}, ranks: [], rankRequirements: {} };

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
DROP SYSTEM (6 CANALES)
===================== */
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  if (!config.channels.reliquies?.includes(message.channel.id)) return;

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
  const pool = pools[index] || objects.class4;

  if (Math.random() <= 0.000001) {
    item = objects.ultra[0];
    message.channel.send(
      `@everyone 🌑 **EL ABISMO HA RESPONDIDO** 🌑\n` +
      `**${message.author.username}** obtuvo **${item.icon} ${item.name}**`
    );
  } else {
    item = pool[Math.floor(Math.random() * pool.length)];
  }

  user.inventory[item.name] ??= { name: item.name, icon: item.icon, qty: 0 };
  user.inventory[item.name].qty++;

  saveUsers();

  message.reply(
    `🧭 **Belaf murmura:** encontraste **${item.icon} ${item.name}**`
  );
});

/* =====================
SLASH COMMANDS
===================== */
const commands = [
  new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),

  new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Intercambiar ítems")
    .addUserOption(o => o.setName("user").setDescription("Usuario").setRequired(true))
    .addStringOption(o => o.setName("item").setDescription("Ítem exacto").setRequired(true))
    .addIntegerOption(o => o.setName("cantidad").setDescription("Cantidad").setRequired(true)),

  new SlashCommandBuilder().setName("setchanneltrade").setDescription("Canal de trade").setDefaultMemberPermissions(0),
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* =====================
TRADE SYSTEM
===================== */
const pendingTrades = new Map();

client.on(Events.InteractionCreate, async interaction => {

  if (interaction.isChatInputCommand()) {
    const user = getUser(interaction.user.id);

    if (interaction.commandName === "trade") {
      if (interaction.channel.id !== config.channels.trade)
        return interaction.reply({ content: "❌ Este no es el canal de trade.", ephemeral: true });

      const target = interaction.options.getUser("user");
      const itemName = interaction.options.getString("item");
      const qty = interaction.options.getInteger("cantidad");

      if (target.id === interaction.user.id)
        return interaction.reply({ content: "❌ No puedes tradear contigo.", ephemeral: true });

      if (!user.inventory[itemName] || user.inventory[itemName].qty < qty)
        return interaction.reply({ content: "❌ No tienes ese ítem.", ephemeral: true });

      const tradeId = `${interaction.user.id}_${target.id}`;
      pendingTrades.set(tradeId, { from: interaction.user.id, to: target.id, itemName, qty });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`trade_accept_${tradeId}`).setLabel("Aceptar").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`trade_cancel_${tradeId}`).setLabel("Cancelar").setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({
        content: `🔁 **Trade propuesto**\n${interaction.user.username} ofrece **${qty} ${itemName}** a ${target.username}`,
        components: [row]
      });
    }
  }

  if (interaction.isButton()) {
    const [_, action, tradeId] = interaction.customId.split("_");
    const trade = pendingTrades.get(tradeId);
    if (!trade) return interaction.reply({ content: "❌ Trade expirado.", ephemeral: true });

    if (action === "cancel") {
      pendingTrades.delete(tradeId);
      return interaction.update({ content: "❌ Trade cancelado.", components: [] });
    }

    if (action === "accept") {
      if (interaction.user.id !== trade.to)
        return interaction.reply({ content: "❌ No eres el destinatario.", ephemeral: true });

      const from = getUser(trade.from);
      const to = getUser(trade.to);

      from.inventory[trade.itemName].qty -= trade.qty;
      if (from.inventory[trade.itemName].qty <= 0)
        delete from.inventory[trade.itemName];

      to.inventory[trade.itemName] ??= { name: trade.itemName, icon: "📦", qty: 0 };
      to.inventory[trade.itemName].qty += trade.qty;

      saveUsers();
      pendingTrades.delete(tradeId);

      return interaction.update({
        content: "✅ **Trade completado con éxito.**",
        components: []
      });
    }
  }
});

/* =====================
READY
===================== */
client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("🧭 Belaf despierta");
});

client.login(TOKEN);

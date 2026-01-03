import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
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
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
const objects = JSON.parse(fs.readFileSync("objects.json", "utf8"));

let users = fs.existsSync("users.json")
  ? JSON.parse(fs.readFileSync("users.json", "utf8"))
  : {};

const saveUsers = () =>
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));

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
  } else {
    const pool = pools[depth];
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
  new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("Ver inventario"),

  new SlashCommandBuilder()
    .setName("mymoney")
    .setDescription("Ver monedas"),

  new SlashCommandBuilder()
    .setName("rankup")
    .setDescription("Subir de rango"),

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
    )
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

  /* ===== SLASH ===== */
  if (interaction.isChatInputCommand()) {
    const user = getUser(interaction.user.id);

    /* INVENTORY */
    if (interaction.commandName === "inventory") {
      const items = Object.values(user.inventory);
      if (!items.length)
        return interaction.reply({ content: "🎒 Vacío", ephemeral: true });

      return interaction.reply({
        content: items.map(i => `${i.icon} ${i.name} x${i.qty}`).join("\n"),
        ephemeral: true
      });
    }

    /* MONEY */
    if (interaction.commandName === "mymoney") {
      return interaction.reply({
        content: `💰 Tienes **${user.money} monedas**`,
        ephemeral: true
      });
    }

    /* SELL */
    if (interaction.commandName === "sell") {
      const mode = interaction.options.getString("mode");

      if (!Object.keys(user.inventory).length)
        return interaction.reply({ content: "🎒 Nada que vender", ephemeral: true });

      if (mode === "all") {
        let earned = 0;
        for (const item of Object.values(user.inventory))
          earned += item.value * item.qty;

        user.inventory = {};
        user.money += earned;
        saveUsers();

        return interaction.reply(`💰 Vendiste todo por **${earned} monedas**`);
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId("sell_item")
        .setPlaceholder("Selecciona un objeto")
        .addOptions(
          Object.values(user.inventory).map(i => ({
            label: i.name,
            value: i.name,
            description: `x${i.qty} (${i.value} monedas)`
          }))
        );

      return interaction.reply({
        content: "Selecciona el objeto a vender:",
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    /* RANKUP */
    if (interaction.commandName === "rankup") {
      if (!user.humanity || user.rank === "narehate")
        return interaction.reply({ content: "❌ No tienes humanidad.", ephemeral: true });

      const order = [
        "bell",
        "silbato_rojo",
        "silbato_azul",
        "silbato_lunar",
        "silbato_negro",
        "silbato_blanco"
      ];
      const costs = [0, 100, 300, 700, 1500, 3000];

      const i = order.indexOf(user.rank);
      if (i === order.length - 1)
        return interaction.reply({ content: "🏅 Rango máximo", ephemeral: true });

      if (user.money < costs[i + 1])
        return interaction.reply({ content: "💰 Monedas insuficientes", ephemeral: true });

      user.money -= costs[i + 1];
      user.rank = order[i + 1];
      saveUsers();

      return interaction.reply(`🏅 Ascendiste a **${user.rank}**`);
    }

    /* TRADE */
    if (interaction.commandName === "trade") {
      const target = interaction.options.getUser("user");

      if (!Object.keys(user.inventory).length)
        return interaction.reply({ content: "🎒 No tienes objetos", ephemeral: true });

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`trade_${interaction.user.id}_${target.id}`)
        .setPlaceholder("Selecciona un objeto")
        .addOptions(
          Object.values(user.inventory).map(i => ({
            label: i.name,
            value: i.name,
            description: `x${i.qty}`
          }))
        );

      return interaction.reply({
        content: `🔁 Selecciona el objeto para ${target.username}`,
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }
  }

  /* ===== SELECT MENUS ===== */
  if (interaction.isStringSelectMenu()) {
    const user = getUser(interaction.user.id);

    /* SELL ONE */
    if (interaction.customId === "sell_item") {
      const name = interaction.values[0];
      const item = user.inventory[name];

      user.money += item.value;
      item.qty--;

      if (item.qty <= 0) delete user.inventory[name];

      saveUsers();
      return interaction.update({
        content: `💰 Vendiste **${name}**`,
        components: []
      });
    }

    /* TRADE */
    if (interaction.customId.startsWith("trade_")) {
      const [, fromId, toId] = interaction.customId.split("_");
      if (interaction.user.id !== fromId)
        return interaction.reply({ content: "❌ No es tu trade", ephemeral: true });

      const target = getUser(toId);
      const name = interaction.values[0];

      user.inventory[name].qty--;
      target.inventory[name] ??= { ...user.inventory[name], qty: 0 };
      target.inventory[name].qty++;

      if (user.inventory[name].qty <= 0) delete user.inventory[name];

      saveUsers();
      return interaction.update({
        content: `🔁 Intercambiaste **${name}**`,
        components: []
      });
    }
  }
});

client.login(TOKEN);

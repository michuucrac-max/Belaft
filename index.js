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
  ChannelType,
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
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

/* =====================
FILES
===================== */
const config = JSON.parse(fs.readFileSync("config.json"));
const objects = JSON.parse(fs.readFileSync("objects.json"));

let users = fs.existsSync("users.json")
  ? JSON.parse(fs.readFileSync("users.json"))
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
DROP SYSTEM
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
  if (depth === 5 && Math.random() <= 0.000001) {
    item = objects.ultra[0];
    message.channel.send(`🌑 **${message.author.username} obtuvo ${item.icon} ${item.name}**`);
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
  new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),

  new SlashCommandBuilder().setName("rankup").setDescription("Subir de rango"),

  new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Vender objetos")
    .addStringOption(o =>
      o.setName("mode")
        .setDescription("Vender uno o todo")
        .setRequired(true)
        .addChoices(
          { name: "Uno", value: "one" },
          { name: "Todo", value: "all" }
        )
    ),

  new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Intercambiar reliquias")
    .addUserOption(o => o.setName("user").setDescription("Usuario").setRequired(true))
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
  if (!interaction.isChatInputCommand()) return;
  const user = getUser(interaction.user.id);

  /* ===== INVENTORY ===== */
  if (interaction.commandName === "inventory") {
    const items = Object.values(user.inventory);
    if (!items.length)
      return interaction.reply({ content: "🎒 Vacío", ephemeral: true });

    return interaction.reply({
      content: items.map(i => `${i.icon} ${i.name} x${i.qty}`).join("\n"),
      ephemeral: true
    });
  }

  /* ===== SELL ===== */
  if (interaction.commandName === "sell") {
    const mode = interaction.options.getString("mode");

    if (!Object.keys(user.inventory).length)
      return interaction.reply({ content: "🎒 Nada que vender", ephemeral: true });

    let earned = 0;

    if (mode === "all") {
      for (const item of Object.values(user.inventory)) {
        earned += item.value * item.qty;
      }
      user.inventory = {};
    }

    if (mode === "one") {
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

    user.money += earned;
    saveUsers();
    return interaction.reply(`💰 Vendido todo por **${earned} monedas**`);
  }

  /* ===== RANKUP ===== */
  if (interaction.commandName === "rankup") {
    if (user.rank === "narehate" || !user.humanity)
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
      return interaction.reply({ content: "🏅 Ya estás en el máximo rango", ephemeral: true });

    if (user.money < costs[i + 1])
      return interaction.reply({ content: "💰 No tienes monedas suficientes", ephemeral: true });

    user.money -= costs[i + 1];
    user.rank = order[i + 1];
    saveUsers();

    return interaction.reply(`🏅 Ascendiste a **${user.rank}**`);
  }

  /* ===== TRADE ===== */
  if (interaction.commandName === "trade") {
    const target = interaction.options.getUser("user");

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
});

client.login(TOKEN);

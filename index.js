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
  ? JSON.parse(fs.readFileSync("config.json"))
  : {
      channels: {
        reliquies: [],
        trade: null,
        sell: null,
        tops: null
      }
    };

const objects = JSON.parse(fs.readFileSync("objects.json"));
let users = fs.existsSync("users.json")
  ? JSON.parse(fs.readFileSync("users.json"))
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
      humanity: true, // false = narehate
      inventory: {},
      messages: 0
    };
    saveUsers();
  }
  return users[id];
}

/* =====================
DROP SYSTEM (NO TOCADO)
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

  const pool = pools[depth] ?? objects.class4;
  const item = pool[Math.floor(Math.random() * pool.length)];

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
      o.setName("user").setDescription("Usuario").setRequired(true)
    ),

  new SlashCommandBuilder().setName("setchannelreliquies").setDescription("Drops").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchanneltrade").setDescription("Trade").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchannelsell").setDescription("Sell").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchanneltops").setDescription("Tops").setDefaultMemberPermissions(0)
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

  /* ===== SETCHANNEL ===== */
  if (interaction.isChatInputCommand() &&
      interaction.commandName.startsWith("setchannel")) {

    const id = interaction.commandName.replace("setchannel", "");
    const multi = id === "reliquies";

    const menu = new ChannelSelectMenuBuilder()
      .setCustomId(id)
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(multi ? 6 : 1);

    return interaction.reply({
      ephemeral: true,
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  if (interaction.isChannelSelectMenu()) {
    if (interaction.customId === "reliquies") config.channels.reliquies = interaction.values;
    if (interaction.customId === "trade") config.channels.trade = interaction.values[0];
    if (interaction.customId === "sell") config.channels.sell = interaction.values[0];
    if (interaction.customId === "tops") config.channels.tops = interaction.values[0];
    saveConfig();
    return interaction.update({ content: "📜 Canal configurado.", components: [] });
  }

  if (!interaction.isChatInputCommand()) return;
  const user = getUser(interaction.user.id);

  /* ===== RANKUP ===== */
  if (interaction.commandName === "rankup") {
    if (!user.humanity)
      return interaction.reply({ ephemeral: true, content: "❌ Los narehates no pueden ascender." });

    const order = ["bell","silbato_rojo","silbato_azul","silbato_lunar","silbato_negro","silbato_blanco"];
    const costs = [0,100,300,700,1500,3000];

    const i = order.indexOf(user.rank);
    if (i === order.length - 1)
      return interaction.reply({ ephemeral: true, content: "🏅 Rango máximo." });

    const cost = costs[i + 1];
    if (user.money < cost)
      return interaction.reply({ ephemeral: true, content: `💰 Necesitas ${cost}` });

    user.money -= cost;
    user.rank = order[i + 1];
    saveUsers();
    return interaction.reply(`🏅 Nuevo rango: **${user.rank}** (💰 -${cost})`);
  }

  /* ===== TRADE ===== */
  if (interaction.commandName === "trade") {
    if (interaction.channelId !== config.channels.trade)
      return interaction.reply({ ephemeral: true, content: "❌ Canal incorrecto." });

    const targetUser = interaction.options.getUser("user");
    const target = getUser(targetUser.id);

    const valid =
      (!user.humanity && !target.humanity) ||
      (user.humanity && !target.humanity);

    if (!valid)
      return interaction.reply({ ephemeral: true, content: "❌ Humanos no pueden tradear entre sí." });

    if (!Object.keys(user.inventory).length)
      return interaction.reply({ ephemeral: true, content: "🎒 Inventario vacío." });

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`trade_${interaction.user.id}_${targetUser.id}`)
      .addOptions(
        Object.values(user.inventory).map(i => ({
          label: i.name,
          value: i.name,
          description: `x${i.qty}`
        }))
      );

    return interaction.reply({
      ephemeral: true,
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }
});

/* =====================
TRADE MENU
===================== */
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isStringSelectMenu()) return;

  if (interaction.customId.startsWith("trade_")) {
    const [, from, to] = interaction.customId.split("_");
    if (interaction.user.id !== from) return;

    const user = getUser(from);
    const target = getUser(to);
    const name = interaction.values[0];

    user.inventory[name].qty--;
    target.inventory[name] ??= { ...user.inventory[name], qty: 0 };
    target.inventory[name].qty++;

    if (user.inventory[name].qty <= 0) delete user.inventory[name];
    saveUsers();

    return interaction.update({ content: "🔁 Trade completado.", components: [] });
  }
});

client.login(TOKEN);

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
        .setDescription("Modo")
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

  new SlashCommandBuilder()
    .setName("setchannelreliquies")
    .setDescription("Canales de drops")
    .setDefaultMemberPermissions(0),

  new SlashCommandBuilder()
    .setName("setchanneltrade")
    .setDescription("Canal de trade")
    .setDefaultMemberPermissions(0),

  new SlashCommandBuilder()
    .setName("setchannelsell")
    .setDescription("Canal de ventas")
    .setDefaultMemberPermissions(0),

  new SlashCommandBuilder()
    .setName("setchanneltops")
    .setDescription("Canal automático de tops")
    .setDefaultMemberPermissions(0)
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("🧭 Belaf despierta");

  /* =====================
  AUTO TOPS CADA 2 MIN
  ===================== */
  setInterval(async () => {
    if (!config.channels.tops) return;

    const channel = await client.channels.fetch(config.channels.tops).catch(() => null);
    if (!channel) return;

    const topMoney = Object.entries(users)
      .sort((a, b) => b[1].money - a[1].money)
      .slice(0, 5)
      .map(([id, u], i) => `${i + 1}. <@${id}> — 💰 ${u.money}`)
      .join("\n");

    const topRelics = Object.entries(users)
      .map(([id, u]) => {
        const count = Object.values(u.inventory)
          .reduce((a, b) => a + b.qty, 0);
        return { id, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((u, i) => `${i + 1}. <@${u.id}> — 🧭 ${u.count}`)
      .join("\n");

    channel.send({
      content:
`@everyone
🏆 **TOPS DEL ABISMO**

💰 **Top Dinero**
${topMoney || "Sin datos"}

🧭 **Top Reliquias**
${topRelics || "Sin datos"}`
    });

  }, 2 * 60 * 1000);
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
      .setPlaceholder("Selecciona canal(es)")
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(multi ? 6 : 1);

    return interaction.reply({
      ephemeral: true,
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  if (interaction.isChannelSelectMenu()) {
    if (interaction.customId === "reliquies")
      config.channels.reliquies = interaction.values;
    if (interaction.customId === "trade")
      config.channels.trade = interaction.values[0];
    if (interaction.customId === "sell")
      config.channels.sell = interaction.values[0];
    if (interaction.customId === "tops")
      config.channels.tops = interaction.values[0];

    saveConfig();
    return interaction.update({ content: "📜 Canal configurado.", components: [] });
  }

  /* ===== SLASH ===== */
  if (!interaction.isChatInputCommand()) return;
  const user = getUser(interaction.user.id);

  if (interaction.commandName === "inventory") {
    const items = Object.values(user.inventory);
    return interaction.reply({
      ephemeral: true,
      content: items.length
        ? items.map(i => `${i.icon} ${i.name} x${i.qty}`).join("\n")
        : "🎒 Vacío"
    });
  }

  if (interaction.commandName === "mymoney") {
    return interaction.reply({ ephemeral: true, content: `💰 ${user.money}` });
  }

  if (interaction.commandName === "sell") {
    const mode = interaction.options.getString("mode");

    if (!Object.keys(user.inventory).length)
      return interaction.reply({ ephemeral: true, content: "🎒 Nada que vender" });

    if (mode === "all") {
      let earned = 0;
      for (const item of Object.values(user.inventory))
        earned += item.value * item.qty;

      user.inventory = {};
      user.money += earned;
      saveUsers();
      return interaction.reply(`💰 Vendiste todo por **${earned}**`);
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId("sell_item")
      .setPlaceholder("Objeto")
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

  if (interaction.commandName === "rankup") {
    const order = ["bell","silbato_rojo","silbato_azul","silbato_lunar","silbato_negro","silbato_blanco"];
    const costs = [0,100,300,700,1500,3000];

    const i = order.indexOf(user.rank);
    if (i === order.length - 1)
      return interaction.reply({ ephemeral: true, content: "🏅 Máximo rango" });

    if (user.money < costs[i + 1])
      return interaction.reply({ ephemeral: true, content: "💰 Insuficiente" });

    user.money -= costs[i + 1];
    user.rank = order[i + 1];
    saveUsers();
    return interaction.reply(`🏅 Ahora eres **${user.rank}**`);
  }

  if (interaction.commandName === "trade") {
    const target = interaction.options.getUser("user");
    if (!Object.keys(user.inventory).length)
      return interaction.reply({ ephemeral: true, content: "🎒 Vacío" });

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`trade_${interaction.user.id}_${target.id}`)
      .setPlaceholder("Objeto")
      .addOptions(
        Object.values(user.inventory).map(i => ({
          label: i.name,
          value: i.name
        }))
      );

    return interaction.reply({
      ephemeral: true,
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }
});

/* ===== SELECT MENUS ===== */
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isStringSelectMenu()) return;

  const user = getUser(interaction.user.id);

  if (interaction.customId === "sell_item") {
    const name = interaction.values[0];
    const item = user.inventory[name];
    user.money += item.value;
    item.qty--;
    if (item.qty <= 0) delete user.inventory[name];
    saveUsers();
    return interaction.update({ content: `💰 Vendiste ${name}`, components: [] });
  }

  if (interaction.customId.startsWith("trade_")) {
    const [, from, to] = interaction.customId.split("_");
    if (interaction.user.id !== from) return;

    const name = interaction.values[0];
    const target = getUser(to);

    user.inventory[name].qty--;
    target.inventory[name] ??= { ...user.inventory[name], qty: 0 };
    target.inventory[name].qty++;

    if (user.inventory[name].qty <= 0) delete user.inventory[name];
    saveUsers();
    return interaction.update({ content: `🔁 Intercambio hecho`, components: [] });
  }
});

client.login(TOKEN);

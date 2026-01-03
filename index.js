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
DROP SYSTEM (6 CANALES ARREGLADO)
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

  // 🔥 6 CANALES = 6 POOLS
  const pools = [
    objects.class4,   // 0 bell
    objects.class3,   // 1 rojo
    objects.class2,   // 2 azul
    objects.class1,   // 3 lunar
    objects.special, // 4 negro
    objects.special  // 5 blanco / ultra
  ];

  const pool = pools[index] || objects.class4;
  let item;

// 🌌 PROBABILIDAD ULTRA RARA 0.0001%
if (Math.random() <= 0.000001) {
  item = objects.ultra[0];

  const guild = message.guild;
  const channel = message.channel;

  channel.send(
    `@everyone 🌑 **EL ABISMO HA RESPONDIDO** 🌑\n` +
    `**${message.author.username}** ha obtenido la **${item.icon} ${item.name}**`
  );
} else {
  item = pool[Math.floor(Math.random() * pool.length)];
}
  user.inventory[item.name] ??= {
    name: item.name,
    icon: item.icon,
    qty: 0
  };

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
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver tus monedas"),
  new SlashCommandBuilder().setName("rankup").setDescription("Ascender de rango"),

  new SlashCommandBuilder().setName("setchannelreliquies").setDescription("Canales de reliquias").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchanneltrade").setDescription("Canal de trade").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchannelsell").setDescription("Canal de venta").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchanneltops").setDescription("Canal de tops").setDefaultMemberPermissions(0),
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* =====================
TOPS (CADA 2 MIN)
===================== */
function sendTops() {
  const guild = client.guilds.cache.first();
  if (!guild || !config.channels?.tops) return;

  const channel = guild.channels.cache.get(config.channels.tops);
  if (!channel) return;

  const members = Object.entries(users)
    .map(([id, data]) => {
      const member = guild.members.cache.get(id);
      if (!member) return null;

      let rankDisplay = data.rank;

      if (member.roles.cache.some(r =>
        r.name.toLowerCase().includes("narehate")
      )) {
        rankDisplay = "narehate";
      }

      return {
        name: member.user.username,
        money: data.money,
        items: Object.values(data.inventory || {}).reduce((a, b) => a + b.qty, 0),
        rank: rankDisplay
      };
    })
    .filter(Boolean);

  if (!members.length) return;

  const topMoney = [...members].sort((a,b)=>b.money-a.money).slice(0,5);
  const topItems = [...members].sort((a,b)=>b.items-a.items).slice(0,5);

  channel.send({
    content:
`@everyone
🏆 **Tops del Abismo**

💰 **Más dinero**
${topMoney.map((u,i)=>`${i+1}. ${u.name} — ${u.money}`).join("\n")}

🎒 **Más reliquias**
${topItems.map((u,i)=>`${i+1}. ${u.name} — ${u.items}`).join("\n")}
`
  });
}

/* =====================
READY
===================== */
client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  setInterval(sendTops, 2 * 60 * 1000);
  console.log("🧭 Belaf despierta");
});

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {

  /* ===== SELECT MENUS ===== */
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
    return interaction.update({ content: "📜 **Belaf lo ha registrado.**", components: [] });
  }

  if (!interaction.isChatInputCommand()) return;
  const user = getUser(interaction.user.id);

  /* ===== INVENTORY ===== */
  if (interaction.commandName === "inventory") {
    const items = Object.values(user.inventory);
    if (!items.length)
      return interaction.reply({ content: "🎒 Vacío", ephemeral: true });

    const text = items.map(e =>
      `${e.icon} **${e.name}** x${e.qty}`
    ).join("\n");

    return interaction.reply({ content: `🎒 **Inventario**\n${text}`, ephemeral: true });
  }

  /* ===== MONEY ===== */
  if (interaction.commandName === "mymoney") {
    return interaction.reply({
      content: `💰 Tienes **${user.money}** monedas`,
      ephemeral: true
    });
  }

  /* ===== RANK UP ===== */
  if (interaction.commandName === "rankup") {
    const member = interaction.member;

    if (member.roles.cache.some(r =>
      r.name.toLowerCase().includes("narehate")
    )) {
      return interaction.reply({
        content: "🩸 **Ya has llegado al final del camino.**\nEso requiere humanidad.",
        ephemeral: true
      });
    }

    const currentIndex = config.ranks.indexOf(user.rank);
    const nextRank = config.ranks[currentIndex + 1];
    if (!nextRank)
      return interaction.reply({ content: "🏔️ Ya no puedes subir más.", ephemeral: true });

    const req = config.rankRequirements[nextRank];

    if (user.money < req.money)
      return interaction.reply({ content: `💰 Necesitas ${req.money} monedas.`, ephemeral: true });

    const item = user.inventory[req.item];
    if (!item || item.qty < 1)
      return interaction.reply({ content: `🎒 Necesitas **${req.item}**.`, ephemeral: true });

    user.money -= req.money;
    item.qty--;
    if (item.qty <= 0) delete user.inventory[req.item];

    user.rank = nextRank;
    saveUsers();

    return interaction.reply(`🎖️ Has ascendido a **${nextRank}**`);
  }

  /* ===== SET CHANNELS ===== */
  if (interaction.commandName === "setchannelreliquies") {
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("reliquies")
        .setMinValues(1)
        .setMaxValues(6)
        .setChannelTypes(ChannelType.GuildText)
        .setPlaceholder("Selecciona los 6 canales del Abismo")
    );
    return interaction.reply({ content: "🧭 Canales de reliquias", components: [row], ephemeral: true });
  }

  if (interaction.commandName === "setchanneltrade") {
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("trade")
        .setMinValues(1).setMaxValues(1)
        .setChannelTypes(ChannelType.GuildText)
    );
    return interaction.reply({ content: "🔁 Canal de trade", components: [row], ephemeral: true });
  }

  if (interaction.commandName === "setchannelsell") {
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("sell")
        .setMinValues(1).setMaxValues(1)
        .setChannelTypes(ChannelType.GuildText)
    );
    return interaction.reply({ content: "💰 Canal de venta", components: [row], ephemeral: true });
  }

  if (interaction.commandName === "setchanneltops") {
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("tops")
        .setMinValues(1).setMaxValues(1)
        .setChannelTypes(ChannelType.GuildText)
    );
    return interaction.reply({ content: "🏆 Canal de tops", components: [row], ephemeral: true });
  }
});

client.login(TOKEN);

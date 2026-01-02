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
  StringSelectMenuBuilder,
  UserSelectMenuBuilder
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
  console.error("Faltan variables de entorno");
  process.exit(1);
}

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
   HELPERS
===================== */
function isNarehate(member) {
  return member.roles.cache.some(r =>
    r.name.toLowerCase().includes(config.roles.narehate.toLowerCase())
  );
}

/* =====================
   DROP SYSTEM
===================== */
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;

  const member = message.member;
  const user = getUser(message.author.id);

  /* RELIQUIAS NORMALES */
  if (config.channels.find?.includes(message.channel.id)) {
    user.messages++;
    if (user.messages % 5 !== 0) return saveUsers();

    const index = config.channels.find.indexOf(message.channel.id);

    let pool = objects.class4;
    if (index >= 1) pool = objects.class3;
    if (index >= 2) pool = objects.class2;
    if (index >= 3) pool = objects.class1;
    if (index >= 4) pool = objects.special;

    const item = pool[Math.floor(Math.random() * pool.length)];
    user.inventory[item.name] ??= { item, qty: 0 };
    user.inventory[item.name].qty++;

    saveUsers();
    return message.reply(`🧭 **Belaf murmura:** encontraste **${item.icon} ${item.name}**`);
  }

  /* ITEMS NAREHATE (+5.6%) */
  if (
    config.channels.items &&
    message.channel.id === config.channels.items &&
    isNarehate(member)
  ) {
    if (Math.random() > 0.056) return;

    const pool = objects.narehate || objects.special;
    const item = pool[Math.floor(Math.random() * pool.length)];

    user.inventory[item.name] ??= { item, qty: 0 };
    user.inventory[item.name].qty++;

    saveUsers();
    return message.reply(`🩸 **El Abismo responde:** obtuviste **${item.icon} ${item.name}**`);
  }
});

/* =====================
   SLASH COMMANDS
===================== */
const commands = [
  new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),
  new SlashCommandBuilder().setName("trade").setDescription("Trade con un Narehate"),

  new SlashCommandBuilder().setName("setchannelreliquies").setDescription("Canales de reliquias").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchanneltrade").setDescription("Canal trade").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchannelsell").setDescription("Canal venta").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchanneltops").setDescription("Canal tops").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchannelitems").setDescription("Canal Narehate").setDefaultMemberPermissions(0),
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* =====================
   TOPS
===================== */
function sendTops() {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  const channel = guild.channels.cache.get(config.channels.tops);
  if (!channel) return;

  const members = Object.entries(users).map(([id, data]) => {
    const member = guild.members.cache.get(id);
    if (!member) return null;

    let rank = data.rank;
    if (isNarehate(member)) rank = "narehate";

    return {
      name: member.user.username,
      money: data.money,
      items: Object.values(data.inventory).reduce((a, b) => a + b.qty, 0),
      rank
    };
  }).filter(Boolean);

  const topMoney = [...members].sort((a,b)=>b.money-a.money).slice(0,10);
  const topItems = [...members].sort((a,b)=>b.items-a.items).slice(0,10);
  const topRank = [...members].sort((a,b)=>config.ranks.indexOf(b.rank)-config.ranks.indexOf(a.rank)).slice(0,10);

  channel.send({
    content:
`@everyone
🏆 **Tops del Abismo**

💰 **Más dinero**
${topMoney.map((u,i)=>`${i+1}. ${u.name} — ${u.money}`).join("\n")}

🎒 **Más reliquias**
${topItems.map((u,i)=>`${i+1}. ${u.name} — ${u.items}`).join("\n")}

🎖️ **Mayor rango**
${topRank.map((u,i)=>`${i+1}. ${u.name} — ${u.rank}`).join("\n")}`
  });
}

/* =====================
   READY
===================== */
client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  setInterval(sendTops, 5 * 60 * 1000);
  console.log("Belaf despierta");
});

/* =====================
   INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {

  /* ===== SELECT CHANNELS ===== */
  if (interaction.isChannelSelectMenu()) {
    if (interaction.customId === "reliquies") config.channels.find = interaction.values;
    if (interaction.customId === "trade") config.channels.trade = interaction.values[0];
    if (interaction.customId === "sell") config.channels.sell = interaction.values[0];
    if (interaction.customId === "tops") config.channels.tops = interaction.values[0];
    if (interaction.customId === "items") config.channels.items = interaction.values[0];

    saveConfig();
    return interaction.update({ content: "📜 **Belaf lo ha registrado.**", components: [] });
  }

  if (!interaction.isChatInputCommand()) return;

  const user = getUser(interaction.user.id);

  /* INVENTORY */
  if (interaction.commandName === "inventory") {
    const items = Object.values(user.inventory);
    if (!items.length)
      return interaction.reply({ content: "🎒 Vacío", ephemeral: true });

    return interaction.reply({
      content: items.map(i => `${i.item.icon} **${i.item.name}** x${i.qty}`).join("\n"),
      ephemeral: true
    });
  }

  /* MONEY */
  if (interaction.commandName === "mymoney") {
    return interaction.reply({ content: `💰 Tienes **${user.money}** monedas`, ephemeral: true });
  }

  /* TRADE */
  if (interaction.commandName === "trade") {
    const items = Object.values(user.inventory);
    if (!items.length)
      return interaction.reply({ content: "🎒 No tienes objetos.", ephemeral: true });

    const menu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("trade_item_self")
        .setPlaceholder("Objeto que ofreces")
        .addOptions(items.map(i => ({
          label: i.item.name,
          value: i.item.name,
          description: `x${i.qty}`
        })))
    );

    return interaction.reply({
      content: "🔁 **Selecciona tu objeto**",
      components: [menu],
      ephemeral: true
    });
  }

  /* SET CHANNEL CMDS */
  if (interaction.commandName.startsWith("setchannel")) {
    const id = interaction.commandName.replace("setchannel", "");
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(id)
        .setMinValues(1)
        .setMaxValues(id === "reliquies" ? 5 : 1)
        .setChannelTypes(ChannelType.GuildText)
    );
    return interaction.reply({ content: "🧭 Selecciona canal", components: [row], ephemeral: true });
  }
});

client.login(TOKEN);

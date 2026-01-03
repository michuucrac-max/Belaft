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
  console.error("Faltan variables de entorno");
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
  if (!config.channels.reliquies?.includes(message.channel.id)) return;

  const user = getUser(message.author.id);
  user.messages++;

  if (user.messages % 5 !== 0) {
    saveUsers();
    return;
  }

  const index = config.channels.reliquies.indexOf(message.channel.id);

  let pool = objects.class4;
  if (index >= 1) pool = objects.class3;
  if (index >= 2) pool = objects.class2;
  if (index >= 3) pool = objects.class1;
  if (index >= 4) pool = objects.special;

  const item = pool[Math.floor(Math.random() * pool.length)];

  user.inventory[item.name] ??= { item, qty: 0 };
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

  new SlashCommandBuilder().setName("setchannelreliquies").setDescription("Canales de reliquias").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchanneltrade").setDescription("Canal de trade").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchannelsell").setDescription("Canal de venta").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchanneltops").setDescription("Canal de tops").setDefaultMemberPermissions(0),
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

  const members = Object.entries(users)
    .map(([id, data]) => {
      const member = guild.members.cache.get(id);
      if (!member) return null;

      return {
        name: member.user.username,
        money: data.money,
        items: Object.values(data.inventory).reduce((a, b) => a + b.qty, 0),
        rank: data.rank
      };
    })
    .filter(Boolean);

  const topMoney = [...members].sort((a,b)=>b.money-a.money).slice(0,10);
  const topItems = [...members].sort((a,b)=>b.items-a.items).slice(0,10);

  channel.send(
`@everyone
🏆 **Tops del Abismo**

💰 **Más dinero**
${topMoney.map((u,i)=>`${i+1}. ${u.name} — ${u.money}`).join("\n")}

🎒 **Más reliquias**
${topItems.map((u,i)=>`${i+1}. ${u.name} — ${u.items}`).join("\n")}
`
  );
}

/* =====================
   READY
===================== */
client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  setInterval(sendTops, 5 * 60 * 1000);
  console.log("🧭 Belaf despierta");
});

/* =====================
   INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {

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

  if (interaction.commandName === "inventory") {
    const items = Object.values(user.inventory);
    if (!items.length)
      return interaction.reply({ content: "🎒 Vacío", ephemeral: true });

    return interaction.reply({
      content: `🎒 **Inventario**\n${items.map(e => `${e.item.icon} **${e.item.name}** x${e.qty}`).join("\n")}`,
      ephemeral: true
    });
  }

  if (interaction.commandName === "mymoney") {
    return interaction.reply({
      content: `💰 Tienes **${user.money}** monedas`,
      ephemeral: true
    });
  }

  if (interaction.commandName === "setchannelreliquies") {
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("reliquies")
        .setMinValues(1)
        .setMaxValues(5)
        .setChannelTypes(ChannelType.GuildText)
        .setPlaceholder("Canales por clase")
    );
    return interaction.reply({ content: "🧭 Canales de reliquias", components: [row], ephemeral: true });
  }

  if (interaction.commandName === "setchanneltrade") {
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("trade")
        .setMinValues(1)
        .setMaxValues(1)
        .setChannelTypes(ChannelType.GuildText)
    );
    return interaction.reply({ content: "🔁 Canal de trade", components: [row], ephemeral: true });
  }

  if (interaction.commandName === "setchannelsell") {
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("sell")
        .setMinValues(1)
        .setMaxValues(1)
        .setChannelTypes(ChannelType.GuildText)
    );
    return interaction.reply({ content: "💰 Canal de venta", components: [row], ephemeral: true });
  }

  if (interaction.commandName === "setchanneltops") {
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("tops")
        .setMinValues(1)
        .setMaxValues(1)
        .setChannelTypes(ChannelType.GuildText)
    );
    return interaction.reply({ content: "🏆 Canal de tops", components: [row], ephemeral: true });
  }
});

client.login(TOKEN);

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

/* =====================
   USER
===================== */
function getUser(id) {
  if (!users[id]) {
    users[id] = { money: 0, inventory: {}, messages: 0 };
    saveUsers();
  }
  return users[id];
}

function getRankFromRoles(member) {
  for (const rank of config.ranks.reverse()) {
    const roleId = config.roles[rank];
    if (member.roles.cache.has(roleId)) return rank;
  }
  return "bell";
}

function isNarehate(member) {
  return member.roles.cache.has(config.roles.narehate);
}

/* =====================
   DROP SYSTEM (7 CANALES)
===================== */
client.on(Events.MessageCreate, message => {
  if (message.author.bot || !message.guild) return;
  if (!config.channels.find.includes(message.channel.id)) return;

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
  user.inventory[item.name] ??= { name: item.name, icon: item.icon, qty: 0 };
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
    .setDescription("Ver tu inventario"),

  new SlashCommandBuilder()
    .setName("mymoney")
    .setDescription("Ver tus monedas"),

  new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Intercambiar objetos"),

  new SlashCommandBuilder()
    .setName("setchannelreliquies")
    .setDescription("Configurar canales de reliquias")
    .setDefaultMemberPermissions(0),

  new SlashCommandBuilder()
    .setName("setchanneltops")
    .setDescription("Configurar canal de tops")
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

  /* INVENTORY */
  if (interaction.commandName === "inventory") {
    const user = getUser(interaction.user.id);
    const items = Object.values(user.inventory);

    if (!items.length)
      return interaction.reply({ content: "🎒 Inventario vacío", ephemeral: true });

    const text = items
      .map(i => `${i.icon} **${i.name}** x${i.qty}`)
      .join("\n");

    return interaction.reply({ content: text, ephemeral: true });
  }

  /* MONEY */
  if (interaction.commandName === "mymoney") {
    const user = getUser(interaction.user.id);
    return interaction.reply({
      content: `💰 Tienes **${user.money}** monedas`,
      ephemeral: true
    });
  }

  /* TRADE */
  if (interaction.commandName === "trade") {
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

  /* SELECT MENUS */
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
      content: `🔁 **Trade**
${interaction.user.username} ofrece **${trade.offer}**`,
      components: [buttons]
    });

    return interaction.update({ content: "📩 Trade enviado", components: [] });
  }

  /* BUTTONS */
  if (interaction.isButton()) {
    const tradeEntry = [...pendingTrades.entries()].find(([_, v]) =>
      v.target === interaction.user.id
    );
    if (!tradeEntry) return;

    const [fromId, data] = tradeEntry;
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

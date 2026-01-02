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
  ButtonBuilder,
  ButtonStyle,
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
    users[id] = { money: 0, rank: "bell", inventory: {}, messages: 0 };
    saveUsers();
  }
  return users[id];
}

function isNarehate(member) {
  return member.roles.cache.some(r =>
    r.name.toLowerCase().includes(config.roles.narehate.toLowerCase())
  );
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

  if (index === 6 && Math.random() > 0.067) return;

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
  new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),
  new SlashCommandBuilder().setName("trade").setDescription("Tradear con un Narehate"),
  new SlashCommandBuilder().setName("setchannelreliquies").setDescription("Canales reliquias").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchanneltops").setDescription("Canal tops").setDefaultMemberPermissions(0)
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

  /* ===== TRADE ===== */
  if (interaction.commandName === "trade") {
    const user = getUser(interaction.user.id);
    const items = Object.values(user.inventory);
    if (!items.length)
      return interaction.reply({ content: "🎒 No tienes objetos.", ephemeral: true });

    const row1 = new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId("trade_user")
        .setPlaceholder("Selecciona un Narehate")
    );

    const row2 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("trade_item")
        .setPlaceholder("Objeto que ofreces")
        .addOptions(items.map(i => ({
          label: i.name,
          value: i.name,
          description: `x${i.qty}`
        })))
    );

    return interaction.reply({
      content: "🔁 **Configura el trade**",
      components: [row1, row2],
      ephemeral: true
    });
  }

  /* ===== SELECT MENUS ===== */
  if (interaction.isUserSelectMenu() && interaction.customId === "trade_user") {
    pendingTrades.set(interaction.user.id, { target: interaction.values[0] });
    return interaction.update({ content: "🧍‍♂️ Narehate seleccionado", components: interaction.message.components });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "trade_item") {
    const trade = pendingTrades.get(interaction.user.id);
    trade.offer = interaction.values[0];

    const targetUser = interaction.guild.members.cache.get(trade.target);
    const targetData = getUser(trade.target);

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("trade_accept").setLabel("Aceptar").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("trade_reject").setLabel("Rechazar").setStyle(ButtonStyle.Danger)
    );

    await targetUser.send({
      content:
`🔁 **Solicitud de trade**
${interaction.user.username} ofrece **${trade.offer}**

¿Aceptas?`,
      components: [buttons]
    });

    return interaction.update({
      content: "📩 Trade enviado al Narehate",
      components: []
    });
  }

  /* ===== BUTTONS ===== */
  if (interaction.isButton()) {
    const trade = [...pendingTrades.entries()].find(([_, v]) =>
      v.target === interaction.user.id
    );
    if (!trade) return;

    const [fromId, data] = trade;
    const fromUser = getUser(fromId);
    const toUser = getUser(interaction.user.id);

    if (interaction.customId === "trade_accept") {
      if (!fromUser.inventory[data.offer]) {
        return interaction.reply({ content: "❌ Objeto inexistente", ephemeral: true });
      }

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

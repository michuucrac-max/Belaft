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
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} from "discord.js";

import fs from "fs";
import express from "express";

// =====================
// ENV
// =====================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

// =====================
// EXPRESS (24/7)
// =====================
const app = express();
app.get("/", (_, res) => res.send("Belaf observa el Abismo"));
app.listen(PORT, () => console.log("Servidor 24/7 activo"));

// =====================
// CLIENT
// =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// =====================
// DATA
// =====================
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
const objects = JSON.parse(fs.readFileSync("objects.json", "utf8"));

let users = fs.existsSync("users.json")
  ? JSON.parse(fs.readFileSync("users.json", "utf8"))
  : {};

const saveUsers = () =>
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));

// =====================
// USER INIT
// =====================
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

// =====================
// SLASH COMMANDS
// =====================
const commands = [
  new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("Ver tu inventario"),

  new SlashCommandBuilder()
    .setName("mymoney")
    .setDescription("Ver tus monedas"),

  new SlashCommandBuilder()
    .setName("rankup")
    .setDescription("Ascender de rango"),

  new SlashCommandBuilder()
    .setName("setchannelreliquies")
    .setDescription("Configurar canales de reliquias")
    .setDefaultMemberPermissions(0)
];

// =====================
// REGISTER COMMANDS
// =====================
const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once(Events.ClientReady, async () => {
  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );
  console.log("Belaf despierta");
});

// =====================
// INTERACTIONS
// =====================
client.on(Events.InteractionCreate, async interaction => {

  // =====================
  // SELECT MENU (CANALES)
  // =====================
  if (interaction.isChannelSelectMenu()) {
    if (interaction.customId !== "select_reliquies") return;

    config.channels.find = interaction.values;
    fs.writeFileSync("config.json", JSON.stringify(config, null, 2));

    return interaction.update({
      content:
        "📜 **Belaf registra los ecos del Abismo:**\n" +
        interaction.values.map(id => `• <#${id}>`).join("\n"),
      components: []
    });
  }

  // =====================
  // SLASH COMMANDS
  // =====================
  if (!interaction.isChatInputCommand()) return;

  const user = getUser(interaction.user.id);

  // INVENTORY (PRIVADO)
  if (interaction.commandName === "inventory") {
    const items = Object.values(user.inventory);
    if (!items.length)
      return interaction.reply({ content: "🎒 Inventario vacío.", ephemeral: true });

    const text = items.map(i => `• ${i.item.name} x${i.qty}`).join("\n");
    return interaction.reply({
      content: `🎒 **Tu inventario:**\n${text}`,
      ephemeral: true
    });
  }

  // MY MONEY (PRIVADO)
  if (interaction.commandName === "mymoney") {
    return interaction.reply({
      content: `💰 Tienes **${user.money}** monedas.`,
      ephemeral: true
    });
  }

  // RANKUP
  if (interaction.commandName === "rankup") {
    const member = await interaction.guild.members.fetch(interaction.user.id);

    // 🚫 Narehate no asciende
    if (member.roles.cache.some(r =>
      r.name.toLowerCase().includes(config.roles.narehate.toLowerCase())
    )) {
      return interaction.reply("🩸 Los Narehates no ascienden.");
    }

    const ranks = config.ranks;
    const idx = ranks.indexOf(user.rank);
    if (idx === -1 || idx === ranks.length - 1)
      return interaction.reply("No puedes ascender más.");

    user.rank = ranks[idx + 1];
    saveUsers();

    return interaction.reply(
      `🎖️ Has ascendido a **${user.rank}**.`
    );
  }

  // SET CHANNEL RELIQUIES
  if (interaction.commandName === "setchannelreliquies") {
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("select_reliquies")
        .setPlaceholder("Selecciona canales por clase")
        .setMinValues(1)
        .setMaxValues(10)
        .addChannelTypes(ChannelType.GuildText)
    );

    return interaction.reply({
      content:
        "📦 **Selecciona los canales de reliquias**\n\n" +
        "• Bells → objetos comunes\n" +
        "• Silbatos altos → objetos especiales",
      components: [row],
      ephemeral: true
    });
  }
});

// =====================
client.login(TOKEN);

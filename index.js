import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  PermissionsBitField
} from "discord.js";

import fs from "fs";
import express from "express";

/* ===================== ENV ===================== */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const PORT = process.env.PORT || 3000;

/* ===================== EXPRESS ===================== */
const app = express();
app.get("/", (_, res) => res.send("Nanachi viva"));
app.listen(PORT, () => console.log(`🌐 Express activo en ${PORT}`));

/* ===================== FILES ===================== */
const configPath = "./config.json";
const objectsPath = "./objects.json";

const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath))
  : { dropChannel: null, ranks: [] };

const objects = fs.existsSync(objectsPath)
  ? JSON.parse(fs.readFileSync(objectsPath))
  : { class4: [], class3: [], class2: [], class1: [], special: [], ultra: [] };

const saveConfig = () =>
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

/* ===================== CLIENT ===================== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

/* ===================== COMMANDS ===================== */
const commands = [
  new SlashCommandBuilder()
    .setName("setranks")
    .setDescription("Configurar rangos")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("setdrop")
    .setDescription("Configurar canal de drops")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("rankup")
    .setDescription("Subir de rango")
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* ===================== READY ===================== */
client.once(Events.ClientReady, async () => {
  console.log(`✅ Conectado como ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
});

/* ===================== INTERACTIONS ===================== */
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() &&
      !interaction.isRoleSelectMenu() &&
      !interaction.isChannelSelectMenu()) return;

  /* ===== SET RANKS ===== */
  if (interaction.isChatInputCommand() && interaction.commandName === "setranks") {
    const menu = new RoleSelectMenuBuilder()
      .setCustomId("set_ranks")
      .setPlaceholder("Selecciona los rangos en orden")
      .setMinValues(1)
      .setMaxValues(10);

    return interaction.reply({
      content: "Selecciona los roles en orden (de menor a mayor)",
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true
    });
  }

  if (interaction.isRoleSelectMenu() && interaction.customId === "set_ranks") {
    config.ranks = interaction.values;
    saveConfig();

    return interaction.update({
      content: "✅ Rangos configurados",
      components: []
    });
  }

  /* ===== SET DROP ===== */
  if (interaction.isChatInputCommand() && interaction.commandName === "setdrop") {
    const menu = new ChannelSelectMenuBuilder()
      .setCustomId("set_drop")
      .addChannelTypes(ChannelType.GuildText);

    return interaction.reply({
      content: "Selecciona el canal de drops",
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true
    });
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === "set_drop") {
    config.dropChannel = interaction.values[0];
    saveConfig();

    return interaction.update({
      content: "✅ Canal de drop configurado",
      components: []
    });
  }

  /* ===== RANKUP ===== */
  if (interaction.isChatInputCommand() && interaction.commandName === "rankup") {
    if (!config.ranks.length)
      return interaction.reply({ content: "Configura rangos primero", ephemeral: true });

    const member = interaction.member;
    const roles = config.ranks;

    let index = roles.findIndex(r => member.roles.cache.has(r));
    index = index === -1 ? 0 : index + 1;

    if (index >= roles.length)
      return interaction.reply({ content: "Ya tienes el máximo rango", ephemeral: true });

    await member.roles.add(roles[index]);

    return interaction.reply("✅ Subiste de rango");
  }
});

/* ===================== DROP SYSTEM ===================== */
client.on(Events.MessageCreate, message => {
  if (message.author.bot) return;
  if (!config.dropChannel) return;
  if (message.channel.id !== config.dropChannel) return;

  if (Math.random() > 0.2) return; // 20% de probabilidad

  const roll = Math.random();
  let pool;

  if (roll < 0.5) pool = objects.class4;
  else if (roll < 0.75) pool = objects.class3;
  else if (roll < 0.9) pool = objects.class2;
  else if (roll < 0.97) pool = objects.special;
  else pool = objects.ultra;

  if (!pool.length) return;

  const item = pool[Math.floor(Math.random() * pool.length)];

  message.reply(`🧭 Encontraste **${item.name}**`);
});

/* ===================== ERROR HANDLER ===================== */
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

/* ===================== LOGIN ===================== */
client.login(TOKEN);

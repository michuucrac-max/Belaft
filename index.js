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
ChannelType,
PermissionsBitField,
EmbedBuilder
} from "discord.js";

import fs from "fs";
import express from "express";

/* ===================== ENV ===================== */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

/* ===================== EXPRESS ===================== */
const app = express();
app.get("/", (_, res) => res.send("Belaf observa el Abismo 🧭"));
app.listen(PORT, () => console.log(`🌐 Express activo en ${PORT}`));

/* ===================== FILES ===================== */
const configPath = "./config.json";
const statusPath = "./status.json";
const objectsPath = "./objects.json";

const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, "utf8"))
  : { channels: { reliquies: null, tops: null } };

const objects = fs.existsSync(objectsPath)
  ? JSON.parse(fs.readFileSync(objectsPath, "utf8"))
  : { class4: [], class3: [], class2: [], class1: [], special: [], ultra: [] };

const status = fs.existsSync(statusPath)
  ? JSON.parse(fs.readFileSync(statusPath, "utf8"))
  : {};

const saveStatus = () => fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
const saveConfig = () => fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
const saveObjects = () => fs.writeFileSync(objectsPath, JSON.stringify(objects, null, 2));

/* ===================== STATUS ===================== */
function getStatus(id) {
  if (!status[id]) status[id] = { money: 0, inventory: {} };
  return status[id];
}

/* ===================== NORMALIZER ===================== */
function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/gi, "")
    .trim();
}

function findRole(guild, name) {
  const t = normalize(name);
  return guild.roles.cache.find(r => normalize(r.name).includes(t));
}

/* ===================== CLIENT ===================== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

/* ===================== SLASH COMMANDS (COMPLETOS) ===================== */
const commands = [
  new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver dinero"),

  new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Vender objetos")
    .addStringOption(o =>
      o.setName("modo")
        .setRequired(true)
        .addChoices(
          { name: "Uno", value: "one" },
          { name: "Todo", value: "all" }
        )
    ),

  new SlashCommandBuilder()
    .setName("rankup")
    .setDescription("Subir rango"),

  new SlashCommandBuilder()
    .setName("setchannelreliquies")
    .setDescription("Configurar canal de drops")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("setmoney")
    .setDescription("Dar dinero")
    .addUserOption(o => o.setName("usuario").setRequired(true))
    .addNumberOption(o => o.setName("cantidad").setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("removemoney")
    .setDescription("Quitar dinero")
    .addUserOption(o => o.setName("usuario").setRequired(true))
    .addNumberOption(o => o.setName("cantidad").setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("seemoney")
    .setDescription("Ver dinero")
    .addUserOption(o => o.setName("usuario").setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("createartefact")
    .setDescription("Crear artefacto")
    .addStringOption(o => o.setName("categoria").setRequired(true))
    .addStringOption(o => o.setName("nombre").setRequired(true))
    .addStringOption(o => o.setName("icono").setRequired(true))
    .addNumberOption(o => o.setName("precio").setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

/* ===================== REST ===================== */
const rest = new REST({ version: "10" }).setToken(TOKEN);

/* ===================== READY ===================== */
client.once(Events.ClientReady, async () => {
  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );

  console.log(`🧭 Bot listo como ${client.user.tag}`);
});

/* ===================== INTERACTIONS ===================== */
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (!interaction.isChatInputCommand()) return;

    /* INVENTORY */
    if (interaction.commandName === "inventory") {
      const u = getStatus(interaction.user.id);
      const items = Object.values(u.inventory);

      return interaction.reply({
        ephemeral: true,
        content: items.length
          ? items.map(i => `${i.icon} ${i.name} x${i.qty}`).join("\n")
          : "Vacío"
      });
    }

    /* MONEY */
    if (interaction.commandName === "mymoney") {
      return interaction.reply({
        ephemeral: true,
        content: `💰 ${getStatus(interaction.user.id).money}`
      });
    }

    /* ADMIN MONEY */
    if (["setmoney","removemoney","seemoney"].includes(interaction.commandName)) {
      const target = interaction.options.getUser("usuario");
      const amount = interaction.options.getNumber("cantidad") || 0;
      const u = getStatus(target.id);

      if (interaction.commandName === "setmoney") u.money += amount;
      if (interaction.commandName === "removemoney") u.money = Math.max(0, u.money - amount);

      saveStatus();

      return interaction.reply({ ephemeral: true, content: "OK" });
    }

    /* RANKUP */
    if (interaction.commandName === "rankup") {
      const member = interaction.member;
      const u = getStatus(member.id);

      const roles = [
        "silbato rojo",
        "silbato azul",
        "silbato lunar",
        "silbato negro",
        "silbato blanco"
      ];

      const costs = [100,250,500,750,1500];

      let idx = -1;

      for (let i = roles.length - 1; i >= 0; i--) {
        const r = findRole(interaction.guild, roles[i]);
        if (r && member.roles.cache.has(r.id)) {
          idx = i;
          break;
        }
      }

      if (idx === roles.length - 1)
        return interaction.reply({ ephemeral: true, content: "Max rango" });

      const nextRole = findRole(interaction.guild, roles[idx + 1]);
      const cost = costs[idx + 1];

      if (!nextRole)
        return interaction.reply({ ephemeral: true, content: "Rol no encontrado" });

      if (u.money < cost)
        return interaction.reply({ ephemeral: true, content: "No dinero" });

      u.money -= cost;
      await member.roles.add(nextRole);

      saveStatus();

      return interaction.reply({
        ephemeral: true,
        content: `Subiste a ${roles[idx + 1]}`
      });
    }

    /* CREATE ARTEFACT */
    if (interaction.commandName === "createartefact") {
      const c = interaction.options.getString("categoria");
      const n = interaction.options.getString("nombre");
      const icon = interaction.options.getString("icono");
      const price = interaction.options.getNumber("precio");

      if (!objects[c])
        return interaction.reply({ ephemeral: true, content: "Categoría inválida" });

      objects[c].push({ name: n, icon, price });
      saveObjects();

      return interaction.reply({ ephemeral: true, content: "Creado" });
    }

  } catch (e) {
    console.error(e);
  }
});

/* ===================== DROPS ===================== */
client.on(Events.MessageCreate, message => {
  if (message.author.bot || !message.guild) return;
  if (message.channel.id !== config.channels.reliquies) return;

  if (Math.random() > 0.15) return;

  const pools = [
    objects.ultra,
    objects.special,
    objects.class1,
    objects.class2,
    objects.class3,
    objects.class4
  ];

  const pool = pools[Math.floor(Math.random() * pools.length)];
  if (!pool.length) return;

  const item = pool[Math.floor(Math.random() * pool.length)];
  const u = getStatus(message.author.id);

  if (!u.inventory[item.name])
    u.inventory[item.name] = { ...item, qty: 0 };

  u.inventory[item.name].qty++;

  saveStatus();

  message.reply(`🧭 ${item.icon} ${item.name}`);
});

/* ===================== LOGIN ===================== */
client.login(TOKEN);

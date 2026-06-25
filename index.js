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
  PermissionsBitField,
  EmbedBuilder,
  StringSelectMenuBuilder
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
EXPRESS
===================== */
const app = express();
app.get("/", (_, res) => res.send("Belaf observa el Abismo 🧭"));
app.listen(PORT, () => console.log(`🌐 Express activo en ${PORT}`));

/* =====================
FILES
===================== */
const configPath = "./config.json";
const statusPath = "./status.json";
const objectsPath = "./objects.json";

const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath))
  : { channels: { reliquies: null } };

const status = fs.existsSync(statusPath)
  ? JSON.parse(fs.readFileSync(statusPath))
  : {};

const objects = fs.existsSync(objectsPath)
  ? JSON.parse(fs.readFileSync(objectsPath))
  : { class4: [], class3: [], class2: [], class1: [], special: [], ultra: [] };

const saveStatus = () => fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
const saveConfig = () => fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

/* =====================
STATUS
===================== */
function getStatus(id) {
  if (!status[id]) status[id] = { money: 0, inventory: {}, lastDrop: 0 };
  return status[id];
}

/* =====================
CLIENT
===================== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

/* =====================
UTILS
===================== */
function normalize(str) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/* =====================
COMANDOS
===================== */
const commands = [
  new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver dinero"),
  new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Vender objetos")
    .addStringOption(o =>
      o.setName("modo")
        .setDescription("Modo de venta: uno o todo")
        .setRequired(true)
        .addChoices({ name: "Uno", value: "one" }, { name: "Todo", value: "all" })
    ),
  new SlashCommandBuilder().setName("rankup").setDescription("Subir rango"),
  new SlashCommandBuilder()
    .setName("setmoney")
    .setDescription("Añadir monedas a un usuario")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true))
    .addNumberOption(o => o.setName("cantidad").setDescription("Cantidad").setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName("removemoney")
    .setDescription("Quitar monedas a un usuario")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true))
    .addNumberOption(o => o.setName("cantidad").setDescription("Cantidad").setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName("seemoney")
    .setDescription("Ver monedas de un usuario")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName("setchannelreliquies")
    .setDescription("Configurar canal de drops")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* =====================
READY
===================== */
client.once(Events.ClientReady, async () => {
  console.log(`🧭 Bot listo como ${client.user.tag}`);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("✅ Comandos registrados");
});

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (!interaction.isChatInputCommand() && !interaction.isChannelSelectMenu()) return;

    // SET CHANNEL RELIQUIES
    if (interaction.commandName === "setchannelreliquies") {
      const menu = new ChannelSelectMenuBuilder()
        .setCustomId("set_reliquies")
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1);

      return interaction.reply({
        ephemeral: true,
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    }

    if (interaction.isChannelSelectMenu() && interaction.customId === "set_reliquies") {
      config.channels.reliquies = interaction.values[0];
      saveConfig();
      return interaction.update({ content: "✅ Canal de reliquias configurado", components: [] });
    }

    // INVENTORY
    if (interaction.commandName === "inventory") {
      const user = getStatus(interaction.user.id);
      if (!Object.keys(user.inventory).length) {
        return interaction.reply({ ephemeral: true, content: "🎒 Inventario vacío" });
      }
      const list = Object.values(user.inventory).map(i => `${i.icon} ${i.name} x${i.qty}`).join("\n");
      return interaction.reply({ ephemeral: true, content: `🎒 INVENTARIO\n${list}` });
    }

    // MYMONEY
    if (interaction.commandName === "mymoney") {
      const user = getStatus(interaction.user.id);
      return interaction.reply({ ephemeral: true, content: `💰 ${user.money} monedas` });
    }

    // SELL
    if (interaction.commandName === "sell") {
      const user = getStatus(interaction.user.id);
      const mode = interaction.options.getString("modo");

      if (!Object.keys(user.inventory).length) {
        return interaction.reply({ ephemeral: true, content: "❌ No tienes objetos" });
      }

      if (mode === "all") {
        let gain = 0;
        for (const i of Object.values(user.inventory)) {
          gain += (i.price ?? 0) * i.qty;
        }
        user.money += gain;
        user.inventory = {};
        saveStatus();
        return interaction.reply({ ephemeral: true, content: `💰 Vendiste todo por ${gain} monedas` });
      }

      return interaction.reply({ ephemeral: true, content: "❌ Usa `/sell modo:all` para vender todo" });
    }

    // RANKUP
    if (interaction.commandName === "rankup") {
      const member = interaction.member;
      const st = getStatus(member.id);

      const order = ["bell","silbato rojo","silbato azul","silbato lunar","silbato negro","silbato blanco"];
      const costs = [0,2500,50000,750000,1500000,30000000];
      const current = getUserRank(member);

      if (current === order.length - 1) {
        return interaction.reply({ ephemeral: true, content: "🏁 Ya tienes el rango máximo" });
      }

      const next = order[current + 1];
      const cost = costs[current + 1];

      if (st.money < cost) {
        return interaction.reply({ ephemeral: true, content: `❌ Necesitas ${cost} monedas` });
      }

      const role = member.guild.roles.cache.find(r => normalize(r.name).includes(next));
      if (!role) {
        return interaction.reply({ ephemeral: true, content: "❌ Rol no encontrado" });
      }

      try {
        await member.roles.add(role);
      } catch {
        return interaction.reply({ ephemeral: true, content: "❌ Sin permisos para dar rol" });
      }

      st.money -= cost;
      saveStatus();
      return interaction.reply({ ephemeral: true, content: `✨ Ahora eres ${role.name}` });
    }

    // ADMIN MONEY
    if (["setmoney","removemoney","seemoney"].includes(interaction.commandName)) {
      const target = interaction.options.getUser("usuario");
      const amount = interaction.options.getNumber("cantidad") || 0;
      const user = getStatus(target.id);

      if (interaction.commandName === "setmoney") {
        user.money += amount;
        save

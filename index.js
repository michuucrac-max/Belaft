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
  StringSelectMenuBuilder // ✅ Import agregado
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
  : { channels: { reliquies: null, tops: null, rankup: null } };

const status = fs.existsSync(statusPath)
  ? JSON.parse(fs.readFileSync(statusPath))
  : {};

const objects = fs.existsSync(objectsPath)
  ? JSON.parse(fs.readFileSync(objectsPath))
  : { class4: [], class3: [], class2: [], class1: [], special: [], ultra: [] };

const saveStatus = () => {
  try {
    fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
  } catch (err) {
    console.error("❌ Error guardando status:", err);
  }
};
const saveConfig = () => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error("❌ Error guardando config:", err);
  }
};

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
  // USER
  new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("Ver el inventario del usuario"),

  new SlashCommandBuilder()
    .setName("mymoney")
    .setDescription("Ver la cantidad de monedas del usuario"),

  new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Vender objetos del inventario")
    .addStringOption(o =>
      o.setName("modo")
        .setDescription("Modo de venta: uno o todo")
        .setRequired(true)
        .addChoices(
          { name: "Uno", value: "one" },
          { name: "Todo", value: "all" }
        )
    ),

  new SlashCommandBuilder()
    .setName("rankup")
    .setDescription("Subir de rango"),

  // ADMIN
  new SlashCommandBuilder()
    .setName("setmoney")
    .setDescription("Añadir monedas a un usuario")
    .addUserOption(o =>
      o.setName("usuario")
        .setDescription("Usuario al que se le añadirán monedas")
        .setRequired(true)
    )
    .addNumberOption(o =>
      o.setName("cantidad")
        .setDescription("Cantidad de monedas a añadir")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("removemoney")
    .setDescription("Quitar monedas a un usuario")
    .addUserOption(o =>
      o.setName("usuario")
        .setDescription("Usuario al que se le quitarán monedas")
        .setRequired(true)
    )
    .addNumberOption(o =>
      o.setName("cantidad")
        .setDescription("Cantidad de monedas a quitar")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("seemoney")
    .setDescription("Ver monedas de un usuario")
    .addUserOption(o =>
      o.setName("usuario")
        .setDescription("Usuario del que se verán las monedas")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  // CONFIG
  new SlashCommandBuilder()
    .setName("setchannelreliquies")
    .setDescription("Configurar canal para drops")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("setchanneltops")
    .setDescription("Configurar canal para tops")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("setchannelrankup")
    .setDescription("Configurar canal para ascensos de rango")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  // OBJETOS
  new SlashCommandBuilder()
    .setName("setitem")
    .setDescription("Dar un objeto a un usuario")
    .addUserOption(o =>
      o.setName("usuario")
        .setDescription("Usuario al que se le dará el objeto")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("removeitem")
    .setDescription("Quitar un objeto a un usuario")
    .addUserOption(o =>
      o.setName("usuario")
        .setDescription("Usuario al que se le quitará el objeto")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

/* =====================
REST
===================== */
const rest = new REST({ version: "10" }).setToken(TOKEN);

/* =====================
READY
===================== */
client.once(Events.ClientReady, async () => {
  console.log(`🧭 Bot listo como ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );

  console.log("✅ Comandos registrados");

  // Aquí puedes seguir con tu lógica de TOPS y TIPS cada 6h
});

/* =====================
ERROR HANDLER
===================== */
process.on("unhandledRejection", err => console.error("❌", err));
process.on("uncaughtException", err => console.error("❌", err));

/* =====================
LOGIN
===================== */
client.login(TOKEN);

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
  new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver dinero"),
  new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Vender objetos")
    .addStringOption(o =>
      o.setName("modo").setRequired(true)
        .addChoices({ name: "Uno", value: "one" }, { name: "Todo", value: "all" })
    ),
  new SlashCommandBuilder().setName("rankup").setDescription("Subir rango"),

  // ADMIN
  new SlashCommandBuilder()
    .setName("setmoney")
    .addUserOption(o => o.setName("usuario").setRequired(true))
    .addNumberOption(o => o.setName("cantidad").setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("removemoney")
    .addUserOption(o => o.setName("usuario").setRequired(true))
    .addNumberOption(o => o.setName("cantidad").setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("seemoney")
    .addUserOption(o => o.setName("usuario").setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  // CONFIG
  new SlashCommandBuilder().setName("setchannelreliquies")
    .setDescription("Configurar canal de drops")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder().setName("setchanneltops")
    .setDescription("Configurar canal de tops")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder().setName("setchannelrankup")
    .setDescription("Configurar canal de rankup")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  // OBJETOS
  new SlashCommandBuilder()
    .setName("setitem")
    .addUserOption(o => o.setName("usuario").setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("removeitem")
    .addUserOption(o => o.setName("usuario").setRequired(true))
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

  // TOP + TIPS cada 6h
  setInterval(async () => {
    const guild = client.guilds.cache.first();
    if (!guild) return;

    // TOP
    if (config.channels.tops) {
      try {
        const members = await guild.members.fetch();
        const arr = [];

        members.forEach(m => {
          if (m.user.bot) return;
          const st = getStatus(m.id);
          arr.push({ tag: m.user.tag, money: st.money });
        });

        arr.sort((a, b) => b.money - a.money);
        const medals = ["🥇", "🥈", "🥉"];
        const desc = arr.slice(0, 10)
          .map((u, i) => `${medals[i] || `#${i + 1}`} ${u.tag} — 💰 ${u.money}`)
          .join("\n");

        const embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle("🏆 TOP EXPLORADORES")
          .setDescription(desc)
          .setFooter({ text: "El Abismo observa..." });

        const ch = guild.channels.cache.get(config.channels.tops);
        if (ch) await ch.send({ content: "@everyone", embeds: [embed] });
      } catch (err) {
        console.error("❌ Error TOP:", err);
      }
    }

    // TIPS
    if (config.channels.tops) {
      const tips = [
        "💡 Vende objetos raros estratégicamente",
        "💡 Guarda dinero para rangos altos",
        "💡 Los drops épicos son muy raros",
        "💡 El spam no aumenta tus probabilidades",
        "💡 Mejora tu rango para presumir",
        "💡 El Abismo siempre recompensa..."
      ];
      const tip = tips[Math.floor(Math.random() * tips.length)];
      const embedTip = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("📢 CONSEJO DEL ABISMO")
        .setDescription(tip);

      const ch = guild.channels.cache.get(config.channels.tops);
      if (ch) await ch.send({ embeds: [embedTip] });
    }
  }, 6 * 60 * 60 * 1000);
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

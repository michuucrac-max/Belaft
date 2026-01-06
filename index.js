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
  PermissionsBitField
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
app.listen(PORT, () =>
  console.log(`🌐 Express levantado en puerto ${PORT}`)
);

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
FILES
===================== */
const configPath = "./config.json";
const statusPath = "./status.json";
const objectsPath = "./objects.json";

const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, "utf8"))
  : { channels: { reliquies: [], trade: null, sell: null, tops: null } };

const objects = fs.existsSync(objectsPath)
  ? JSON.parse(fs.readFileSync(objectsPath, "utf8"))
  : { class4: [], class3: [], class2: [], special: [] };

const status = fs.existsSync(statusPath)
  ? JSON.parse(fs.readFileSync(statusPath, "utf8"))
  : {};

const saveStatus = () =>
  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));

const saveConfig = () =>
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

/* =====================
RANGOS
===================== */
const RANK_ROLES = [
  { name: "Bell", id: "1456176950849572979" },
  { name: "Silbato rojo", id: "1456178133240778763" },
  { name: "Silbato azul", id: "1456178299364573348" },
  { name: "Silbato lunar", id: "1456179008625447105" },
  { name: "Silbato negro", id: "1456178700096635002" },
  { name: "Silbato blanco", id: "1456179085364695133" }
];

const NAREHATE_ROLE_ID = "1456180289465483396";

/* =====================
STATUS MANAGEMENT
===================== */
function getStatus(id, member = null) {
  if (!status[id]) {
    status[id] = {
      money: 0,
      rank: "Bell",
      humanity: true,
      inventory: {},
      messages: 0
    };
  }

  if (member) {
    const roleOrder = [
      "Bell",
      "Silbato rojo",
      "Silbato azul",
      "Silbato lunar",
      "Silbato negro",
      "Silbato blanco",
      "Narehate"
    ];
    const memberRoles = member.roles.cache.map(r => r.name);
    const matchedRole = [...roleOrder].reverse().find(r =>
      memberRoles.includes(r)
    );
    if (matchedRole) status[id].rank = matchedRole;
    status[id].humanity = !member.roles.cache.has(NAREHATE_ROLE_ID);
  }

  saveStatus();
  return status[id];
}

function getDiscordRank(member) {
  if (!member) return "Sin rango";
  if (member.roles.cache.has(NAREHATE_ROLE_ID)) return "Narehate";
  for (let i = RANK_ROLES.length - 1; i >= 0; i--) {
    if (member.roles.cache.has(RANK_ROLES[i].id))
      return RANK_ROLES[i].name;
  }
  return "Sin rango";
}

/* =====================
DROP SYSTEM
===================== */
client.on(Events.MessageCreate, message => {
  if (message.author.bot || !message.guild) return;
  if (!config.channels.reliquies.includes(message.channel.id)) return;

  const depth = config.channels.reliquies.indexOf(message.channel.id);
  const user = getStatus(message.author.id, message.member);
  user.messages++;

  if (user.messages % 5 !== 0) return;

  const pools = [
    objects.class4,
    objects.class3,
    objects.class2,
    objects.special,
    objects.special,
    objects.special
  ];

  const pool = pools[depth] ?? objects.class4;
  if (!pool.length) return;

  const item = pool[Math.floor(Math.random() * pool.length)];

  if (!user.inventory[item.name]) {
    user.inventory[item.name] = {
      name: item.name,
      icon: item.icon,
      price: item.price ?? item.value ?? 0,
      qty: 0
    };
  }

  user.inventory[item.name].qty++;
  saveStatus();

  message.reply(`🧭 Encontraste ${item.icon} ${item.name}`);
});

/* =====================
COMMANDS
===================== */
const commands = [
  new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),
  new SlashCommandBuilder().setName("rankup").setDescription("Subir de rango"),
  new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Vender reliquias")
    .addStringOption(o =>
      o.setName("mode").setDescription("Modo de venta").setRequired(true)
        .addChoices({ name: "Uno", value: "one" }, { name: "Todo", value: "all" })
    ),
  new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Intercambiar reliquias")
    .addUserOption(o => o.setName("user").setDescription("Usuario").setRequired(true)),
  new SlashCommandBuilder().setName("setchannelreliquies").setDescription("Configurar drops").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder().setName("setchanneltrade").setDescription("Configurar trade").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder().setName("setchannelsell").setDescription("Configurar sell").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder().setName("setchanneltops").setDescription("Configurar tops").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (
      !interaction.isChatInputCommand() &&
      !interaction.isChannelSelectMenu() &&
      !interaction.isStringSelectMenu()
    ) return;

    /* =====================
    CHAT COMMANDS
    ===================== */
    if (interaction.isChatInputCommand()) {
      const user = getStatus(interaction.user.id, interaction.member);

      /* ===== INVENTORY ===== */
      if (interaction.commandName === "inventory") {
        if (!Object.keys(user.inventory).length) {
          return interaction.reply({
            ephemeral: true,
            content: "🎒 Tu inventario está vacío."
          });
        }

        const list = Object.values(user.inventory)
          .map(i => `${i.icon} ${i.name} x${i.qty}`)
          .join("\n");

        return interaction.reply({
          ephemeral: true,
          content: `🎒 **Inventario**\n${list}`
        });
      }

      /* ===== MY MONEY ===== */
      if (interaction.commandName === "mymoney") {
        return interaction.reply({
          ephemeral: true,
          content: `💰 Tienes ${user.money} monedas.`
        });
      }

      /* =====================
      SETCHANNEL (MENÚ)
      ===================== */
      if (interaction.commandName.startsWith("setchannel")) {
        if (
          !interaction.member.permissions.has(
            PermissionsBitField.Flags.Administrator
          )
        ) {
          return interaction.reply({
            ephemeral: true,
            content: "❌ No tienes permisos."
          });
        }

        const row = new ActionRowBuilder().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId(`set_${interaction.commandName}`)
            .setPlaceholder("Selecciona un canal")
            .addChannelTypes(ChannelType.GuildText)
        );

        return interaction.reply({
          ephemeral: true,
          content: "📌 Selecciona el canal:",
          components: [row]
        });
      }
    }

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (
      !interaction.isChatInputCommand() &&
      !interaction.isChannelSelectMenu() &&
      !interaction.isStringSelectMenu()
    ) return;

    /* =====================
    CHAT COMMANDS
    ===================== */
    if (interaction.isChatInputCommand()) {
      const user = getStatus(interaction.user.id, interaction.member);

      /* ===== INVENTORY ===== */
      if (interaction.commandName === "inventory") {
        if (!Object.keys(user.inventory).length) {
          return interaction.reply({
            ephemeral: true,
            content: "🎒 Tu inventario está vacío."
          });
        }

        const list = Object.values(user.inventory)
          .map(i => `${i.icon} ${i.name} x${i.qty}`)
          .join("\n");

        return interaction.reply({
          ephemeral: true,
          content: `🎒 **Inventario**\n${list}`
        });
      }

      /* ===== MY MONEY ===== */
      if (interaction.commandName === "mymoney") {
        return interaction.reply({
          ephemeral: true,
          content: `💰 Tienes ${user.money} monedas.`
        });
      }

      /* =====================
      SETCHANNEL (MENÚ)
      ===================== */
      if (interaction.commandName.startsWith("setchannel")) {
        if (
          !interaction.member.permissions.has(
            PermissionsBitField.Flags.Administrator
          )
        ) {
          return interaction.reply({
            ephemeral: true,
            content: "❌ No tienes permisos."
          });
        }

        const isReliquies =
          interaction.commandName === "setchannelreliquies";

        const row = new ActionRowBuilder().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId(`set_${interaction.commandName}`)
            .setPlaceholder(
              isReliquies
                ? "Selecciona hasta 6 canales de reliquias"
                : "Selecciona un canal"
            )
            .setMinValues(1)
/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (
      !interaction.isChatInputCommand() &&
      !interaction.isChannelSelectMenu()
    ) return;

    /* =====================
    CHAT COMMANDS
    ===================== */
    if (interaction.isChatInputCommand()) {
      const user = getStatus(interaction.user.id, interaction.member);

      /* ===== INVENTORY ===== */
      if (interaction.commandName === "inventory") {
        if (!Object.keys(user.inventory).length) {
          return interaction.reply({
            ephemeral: true,
            content: "🎒 Tu inventario está vacío."
          });
        }

        const list = Object.values(user.inventory)
          .map(i => `${i.icon} ${i.name} x${i.qty}`)
          .join("\n");

        return interaction.reply({
          ephemeral: true,
          content: `🎒 **Inventario**\n${list}`
        });
      }

      /* ===== MY MONEY ===== */
      if (interaction.commandName === "mymoney") {
        return interaction.reply({
          ephemeral: true,
          content: `💰 Tienes ${user.money} monedas.`
        });
      }

      /* =====================
      SETCHANNEL (MENÚ)
      ===================== */
      if (interaction.commandName.startsWith("setchannel")) {
        if (
          !interaction.member.permissions.has(
            PermissionsBitField.Flags.Administrator
          )
        ) {
          return interaction.reply({
            ephemeral: true,
            content: "❌ No tienes permisos."
          });
        }

        const isReliquies =
          interaction.commandName === "setchannelreliquies";

        const row = new ActionRowBuilder().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId(`set_${interaction.commandName}`)
            .setPlaceholder(
              isReliquies
                ? "Selecciona hasta 6 canales de reliquias"
                : "Selecciona un canal"
            )
            .setMinValues(1)
            .setMaxValues(isReliquies ? 6 : 1)
            .addChannelTypes(ChannelType.GuildText)
        );

        return interaction.reply({
          ephemeral: true,
          content: "📌 Selecciona el canal:",
          components: [row]
        });
      }
    }

    /* =====================
    CHANNEL SELECT
    ===================== */
    if (interaction.isChannelSelectMenu()) {
      const id = interaction.customId;

      /* ===== TOPS ===== */
      if (id === "set_setchanneltops") {
        config.channels.tops = interaction.values[0];
      }

      /* ===== TRADE ===== */
      if (id === "set_setchanneltrade") {
        config.channels.trade = interaction.values[0];
      }

      /* ===== SELL ===== */
      if (id === "set_setchannelsell") {
        config.channels.sell = interaction.values[0];
      }

      /* ===== RELIQUIES (MULTI 6 CANALES) ===== */
      if (id === "set_setchannelreliquies") {
        config.channels.reliquies = interaction.values;
      }

      saveConfig();

      return interaction.update({
        content: "✅ Canal configurado correctamente.",
        components: []
      });
    }
  } catch (err) {
    console.error("❌ Interaction error:", err);
    if (!interaction.replied) {
      interaction.reply({
        ephemeral: true,
        content: "❌ Ocurrió un error."
      });
    }
  }
});

/* =====================
TOP EXPLORADORES
===================== */
async function sendTopExploradores() {
  if (!config.channels.tops) return;

  const channel = await client.channels
    .fetch(config.channels.tops)
    .catch(() => null);
  if (!channel || !channel.guild) return;

  const data = [];

  for (const [id, u] of Object.entries(status)) {
    let member = null;
    try {
      member = await channel.guild.members.fetch(id);
    } catch {}

    const totalItems = Object.values(u.inventory ?? {}).reduce(
      (sum, i) => sum + (i.qty ?? 0),
      0
    );

    data.push({
      id,
      tag: member ? member.user.tag : "Usuario salido",
      rank: getDiscordRank(member),
      money: u.money ?? 0,
      items: totalItems
    });
  }

  const top = data.sort((a, b) => b.money - a.money).slice(0, 10);
  if (!top.length) return;

  const text = top
    .map(
      (u, i) =>
        `${i + 1}. ${u.tag}\n🧭 Rango: ${u.rank}\n💰 Dinero: ${u.money}\n🎒 Objetos: ${u.items}`
    )
    .join("\n\n");

  await channel.send({
    content: `🏆 **TOP EXPLORADORES** 🏆\n\n${text}`
  });
}

/* Enviar top cada 10 minutos */
setInterval(sendTopExploradores, 10 * 60 * 1000);

/* =====================
SAFE SAVE
===================== */
process.on("SIGINT", () => {
  saveStatus();
  process.exit();
});
process.on("SIGTERM", () => {
  saveStatus();
  process.exit();
});
process.on("uncaughtException", err => {
  console.error(err);
  saveStatus();
  process.exit(1);
});

/* =====================
CLIENT READY
===================== */
client.once(Events.ClientReady, async () => {
  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );

  console.log(`🧭 Belaf despierta como ${client.user.tag}`);
});
  
/* =====================
LOGIN
===================== */
client.login(TOKEN);

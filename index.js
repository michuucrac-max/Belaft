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
app.listen(PORT, () => console.log(`🌐 Express levantado en puerto ${PORT}`));

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

const objects = JSON.parse(fs.readFileSync(objectsPath, "utf8"));

const status = fs.existsSync(statusPath)
  ? JSON.parse(fs.readFileSync(statusPath, "utf8"))
  : {};

const saveStatus = () =>
  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));

const saveConfig = () =>
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

/* =====================
RANGOS POR ID (OFICIAL)
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

  message.reply(`🧭 Encontraste **${item.icon} ${item.name}**`);
});

/* =====================
SLASH COMMANDS
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
  if (!interaction.isChatInputCommand() && !interaction.isChannelSelectMenu() && !interaction.isStringSelectMenu()) return;

  const user = getStatus(interaction.user.id, interaction.member);

  /* ===== SETCHANNEL COMMANDS ===== */
  if (interaction.isChatInputCommand() && interaction.commandName.startsWith("setchannel")) {
    const id = interaction.commandName.replace("setchannel", "");
    const multi = id === "reliquies";

    const menu = new ChannelSelectMenuBuilder()
      .setCustomId(`setchannel_${id}`)
      .setPlaceholder("Selecciona canal(es)")
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(multi ? 6 : 1);

    return interaction.reply({
      ephemeral: true,
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  if (interaction.isChannelSelectMenu() && interaction.customId.startsWith("setchannel_")) {
    const id = interaction.customId.replace("setchannel_", "");

    if (id === "reliquies") config.channels.reliquies = interaction.values;
    if (id === "trade") config.channels.trade = interaction.values[0];
    if (id === "sell") config.channels.sell = interaction.values[0];
    if (id === "tops") config.channels.tops = interaction.values[0];

    saveConfig();
    return interaction.update({ content: "📜 Canal configurado.", components: [] });
  }

  /* ===== INVENTORY ===== */
  if (interaction.isChatInputCommand() && interaction.commandName === "inventory") {
    if (!Object.keys(user.inventory).length)
      return interaction.reply({ ephemeral: true, content: "🎒 Tu inventario está vacío." });

    const list = Object.values(user.inventory)
      .map(i => `${i.icon} ${i.name} x${i.qty}`)
      .join("\n");

    return interaction.reply({ ephemeral: true, content: `🎒 **Inventario**\n${list}` });
  }

  /* ===== MY MONEY ===== */
  if (interaction.isChatInputCommand() && interaction.commandName === "mymoney") {
    return interaction.reply({ ephemeral: true, content: `💰 Tienes ${user.money} monedas.` });
  }

  /* ===== RANKUP ===== */
  if (interaction.isChatInputCommand() && interaction.commandName === "rankup") {
    if (!user.humanity)
      return interaction.reply({ ephemeral: true, content: "❌ Los narehates no pueden ascender." });

    const order = ["Bell","Silbato rojo","Silbato azul","Silbato lunar","Silbato negro","Silbato blanco"];
    const costs = [0,100,300,700,1500,3000];

    const i = order.indexOf(user.rank);
    if (i === order.length - 1)
      return interaction.reply({ ephemeral: true, content: "🏅 Rango máximo." });

    const cost = costs[i + 1];
    if (user.money < cost)
      return interaction.reply({ ephemeral: true, content: `💰 Necesitas ${cost} monedas.` });

    user.money -= cost;
    user.rank = order[i + 1];
    saveStatus();

    return interaction.reply(`🏅 Ascendiste a **${user.rank}** (-${cost} 💰)`);
  }

  /* ===== SELL ===== */
  if (interaction.isChatInputCommand() && interaction.commandName === "sell") {
    const mode = interaction.options.getString("mode");
    if (!Object.keys(user.inventory).length)
      return interaction.reply({ ephemeral: true, content: "🎒 No tienes objetos." });

    let sold = [];
    if (mode === "one") {
      const item = Object.values(user.inventory)[0];
      user.money += item.price;
      item.qty--;
      sold.push(`${item.icon} ${item.name}`);
      if (item.qty <= 0) delete user.inventory[item.name];
    } else {
      for (const i of Object.values(user.inventory)) {
        user.money += i.price * i.qty;
        sold.push(`${i.icon} ${i.name} x${i.qty}`);
      }
      user.inventory = {};
    }

    saveStatus();
    return interaction.reply({ ephemeral: true, content: `💰 Vendiste: ${sold.join(", ")}` });
  }
});

/* =====================
SAFE SAVE
===================== */
process.on("SIGINT", () => { saveStatus(); process.exit(); });
process.on("SIGTERM", () => { saveStatus(); process.exit(); });
process.on("uncaughtException", err => { console.error(err); saveStatus(); process.exit(1); });

/* =====================
CLIENT READY
===================== */
client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log(`🧭 Belaf despierta como ${client.user.tag}`);
});

/* =====================
LOGIN
===================== */
client.login(TOKEN).then(() => console.log("🔑 Intentando conectar con Discord..."));

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
app.listen(PORT);

/* =====================
CLIENT
===================== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

/* =====================
FILES
===================== */
const configPath = "./config.json";
const usersPath = "./users.json";
const objectsPath = "./objects.json";

const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, "utf8"))
  : { channels: { reliquies: [], trade: null, sell: null, tops: null } };

const objects = JSON.parse(fs.readFileSync(objectsPath, "utf8"));

const users = fs.existsSync(usersPath)
  ? JSON.parse(fs.readFileSync(usersPath, "utf8"))
  : {};

const saveUsers = () =>
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

const saveConfig = () =>
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

/* =====================
USER MANAGEMENT
===================== */
function getUser(id, guildMember = null) {
  if (!users[id]) {
    users[id] = {
      money: 0,
      rank: "bell",
      humanity: true,
      inventory: {},
      messages: 0
    };
  }

  if (guildMember) {
    const roleOrder = [
      "bell",
      "silbato_rojo",
      "silbato_azul",
      "silbato_lunar",
      "silbato_negro",
      "silbato_blanco",
      "narehate"
    ];

    const memberRoles = guildMember.roles.cache.map(r => r.name);
    const matchedRole = [...roleOrder].reverse().find(r =>
      memberRoles.includes(r)
    );

    if (matchedRole) users[id].rank = matchedRole;
  }

  updateHumanity(users[id]);
  saveUsers();
  return users[id];
}

function updateHumanity(user) {
  const narehateRanks = [
    "silbato_rojo",
    "silbato_azul",
    "silbato_lunar",
    "silbato_negro",
    "silbato_blanco",
    "narehate"
  ];
  user.humanity = !narehateRanks.includes(user.rank);
}

/* =====================
DROP SYSTEM
===================== */
client.on(Events.MessageCreate, message => {
  if (message.author.bot || !message.guild) return;
  if (!config.channels.reliquies.includes(message.channel.id)) return;

  const depth = config.channels.reliquies.indexOf(message.channel.id);
  const user = getUser(message.author.id, message.member);
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
  saveUsers();

  message.reply(`🧭 Encontraste **${item.icon} ${item.name}**`);
});

/* =====================
SLASH COMMANDS
===================== */
const commands = [
  new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("Ver inventario"),

  new SlashCommandBuilder()
    .setName("mymoney")
    .setDescription("Ver monedas"),

  new SlashCommandBuilder()
    .setName("rankup")
    .setDescription("Subir de rango"),

  new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Vender reliquias")
    .addStringOption(o =>
      o
        .setName("mode")
        .setDescription("Modo de venta")
        .setRequired(true)
        .addChoices(
          { name: "Uno", value: "one" },
          { name: "Todo", value: "all" }
        )
    ),

  new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Intercambiar reliquias")
    .addUserOption(o =>
      o.setName("user").setDescription("Usuario").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("setchannelreliquies")
    .setDescription("Configurar drops")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("setchanneltrade")
    .setDescription("Configurar trade")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("setchannelsell")
    .setDescription("Configurar sell")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("setchanneltops")
    .setDescription("Configurar tops")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {
  if (
    !interaction.isChatInputCommand() &&
    !interaction.isChannelSelectMenu() &&
    !interaction.isStringSelectMenu()
  ) return;

  const user = getUser(interaction.user.id, interaction.member);

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

  /* ===== CHANNEL SELECT ===== */
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

    const order = ["bell","silbato_rojo","silbato_azul","silbato_lunar","silbato_negro","silbato_blanco"];
    const costs = [0,100,300,700,1500,3000];

    const i = order.indexOf(user.rank);
    if (i === order.length - 1)
      return interaction.reply({ ephemeral: true, content: "🏅 Rango máximo." });

    const cost = costs[i + 1];
    if (user.money < cost)
      return interaction.reply({ ephemeral: true, content: `💰 Necesitas ${cost} monedas.` });

    user.money -= cost;
    user.rank = order[i + 1];
    updateHumanity(user);
    saveUsers();

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

    saveUsers();
    return interaction.reply({ ephemeral: true, content: `💰 Vendiste: ${sold.join(", ")}` });
  }

  /* ===== TRADE ===== */
  if (interaction.isChatInputCommand() && interaction.commandName === "trade") {
    if (interaction.channelId !== config.channels.trade)
      return interaction.reply({ ephemeral: true, content: "❌ Canal incorrecto." });

    const targetUser = interaction.options.getUser("user");
    const target = getUser(targetUser.id, interaction.guild.members.cache.get(targetUser.id));

    if (user.humanity && target.humanity)
      return interaction.reply({ ephemeral: true, content: "❌ Humanos no pueden tradear entre sí." });

    const items = Object.values(user.inventory).filter(i => i.qty > 0);
    if (!items.length)
      return interaction.reply({ ephemeral: true, content: "🎒 Inventario vacío." });

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`trade_${interaction.user.id}_${targetUser.id}`)
      .setPlaceholder("Selecciona objeto")
      .addOptions(items.map(i => ({
        label: i.name,
        value: i.name,
        description: `x${i.qty}`
      })));

    return interaction.reply({
      ephemeral: true,
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  /* ===== TRADE MENU ===== */
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("trade_")) {
    const [, from, to] = interaction.customId.split("_");
    if (interaction.user.id !== from) return;

    const fromUser = getUser(from, interaction.guild.members.cache.get(from));
    const toUser = getUser(to, interaction.guild.members.cache.get(to));
    const name = interaction.values[0];

    fromUser.inventory[name].qty--;
    if (!toUser.inventory[name]) {
      toUser.inventory[name] = { ...fromUser.inventory[name], qty: 0 };
    }
    toUser.inventory[name].qty++;

    if (fromUser.inventory[name].qty <= 0)
      delete fromUser.inventory[name];

    saveUsers();
    return interaction.update({ content: "🔁 Trade completado.", components: [] });
  }
});

client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("🧭 Belaf despierta");
});

client.login(TOKEN);

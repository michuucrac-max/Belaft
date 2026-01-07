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
app.listen(PORT, () => console.log(`🌐 Express activo en ${PORT}`));

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
STATUS
===================== */
function getStatus(id) {
  if (!status[id]) {
    status[id] = {
      money: 0,
      inventory: {},
      messages: 0
    };
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
  const user = getStatus(message.author.id);
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
      price: item.price ?? 10,
      qty: 0
    };
  }

  user.inventory[item.name].qty++;
  saveStatus();

  message.reply(`🧭 Encontraste **${item.icon} ${item.name}**`);
});

/* =====================
COMMANDS
===================== */
const commands = [
  new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),
  new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Vender reliquias")
    .addStringOption(o =>
      o.setName("modo")
        .setDescription("Modo de venta")
        .setRequired(true)
        .addChoices(
          { name: "Uno", value: "one" },
          { name: "Todo", value: "all" }
        )
    ),
  new SlashCommandBuilder()
    .setName("setchannelreliquies")
    .setDescription("Configurar drops")
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

  /* ===== SETCHANNEL ===== */
  if (interaction.isChatInputCommand() &&
      interaction.commandName.startsWith("setchannel")) {

    const id = interaction.commandName.replace("setchannel", "");
    const menu = new ChannelSelectMenuBuilder()
      .setCustomId(`set_${id}`)
      .setPlaceholder("Selecciona canal")
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(id === "reliquies" ? 6 : 1);

    return interaction.reply({
      ephemeral: true,
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  if (interaction.isChannelSelectMenu() &&
      interaction.customId.startsWith("set_")) {

    const id = interaction.customId.replace("set_", "");
    if (id === "reliquies") config.channels.reliquies = interaction.values;
    if (id === "tops") config.channels.tops = interaction.values[0];

    saveConfig();
    return interaction.update({ content: "📜 Canal configurado.", components: [] });
  }

  /* ===== INVENTORY ===== */
  if (interaction.isChatInputCommand() &&
      interaction.commandName === "inventory") {

    const user = getStatus(interaction.user.id);
    if (!Object.keys(user.inventory).length)
      return interaction.reply({ ephemeral: true, content: "🎒 Vacío." });

    const list = Object.values(user.inventory)
      .map(i => `${i.icon} ${i.name} x${i.qty}`)
      .join("\n");

    return interaction.reply({ ephemeral: true, content: `🎒 **Inventario**\n${list}` });
  }

  /* ===== MONEY ===== */
  if (interaction.isChatInputCommand() &&
      interaction.commandName === "mymoney") {

    const user = getStatus(interaction.user.id);
    return interaction.reply({ ephemeral: true, content: `💰 ${user.money} monedas` });
  }

  /* ===== SELL ===== */
  if (interaction.isChatInputCommand() &&
      interaction.commandName === "sell") {

    const user = getStatus(interaction.user.id);
    const mode = interaction.options.getString("modo");

    if (!Object.keys(user.inventory).length)
      return interaction.reply({ ephemeral: true, content: "❌ No tienes objetos." });

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`sell_${mode}`)
      .setPlaceholder("Selecciona objeto")
      .addOptions(
        Object.values(user.inventory).map(i => ({
          label: i.name,
          description: `x${i.qty} | 💰 ${i.price}`,
          value: i.name
        }))
      );

    return interaction.reply({
      ephemeral: true,
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  if (interaction.isStringSelectMenu() &&
      interaction.customId.startsWith("sell_")) {

    const mode = interaction.customId.replace("sell_", "");
    const itemName = interaction.values[0];
    const user = getStatus(interaction.user.id);
    const item = user.inventory[itemName];

    let gain = 0;

    if (mode === "one") {
      item.qty--;
      gain = item.price;
    } else {
      gain = item.qty * item.price;
      delete user.inventory[itemName];
    }

    if (item.qty <= 0) delete user.inventory[itemName];

    user.money += gain;
    saveStatus();

    return interaction.update({
      content: `💰 Vendido **${itemName}** por ${gain} monedas.`,
      components: []
    });
  }
});

/* =====================
TOPS SYSTEM
===================== */
async function sendTops() {
  if (!config.channels.tops) return;

  const ch = await client.channels.fetch(config.channels.tops).catch(() => null);
  if (!ch) return;

  const users = Object.entries(status);

  const topMoney = [...users]
    .sort((a,b) => b[1].money - a[1].money)
    .slice(0,5)
    .map((u,i) => `${i+1}. <@${u[0]}> — 💰 ${u[1].money}`)
    .join("\n");

  const topMsg = [...users]
    .sort((a,b) => b[1].messages - a[1].messages)
    .slice(0,5)
    .map((u,i) => `${i+1}. <@${u[0]}> — 💬 ${u[1].messages}`)
    .join("\n");

  await ch.send(
    `🏆 **TOPS DEL ABISMO**\n\n` +
    `💰 **Riqueza**\n${topMoney || "Sin datos"}\n\n` +
    `💬 **Actividad**\n${topMsg || "Sin datos"}`
  );
}

/* =====================
READY
===================== */
client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log(`🧭 Belaf despierta como ${client.user.tag}`);
  setInterval(sendTops, 10 * 60 * 1000);
});

client.login(TOKEN);

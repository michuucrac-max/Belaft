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

/* ===================== RANKS ===================== */
const ranks = {
  bell: "1456176950849572979",
  silbato_rojo: "1456178133240778763",
  silbato_azul: "1456178299364573348",
  silbato_lunar: "1456179008625447105",
  silbato_negro: "1456178700096635002",
  silbato_blanco: "1456179085364695133"
};

/* ===================== STATUS ===================== */
function getStatus(id) {
  if (!status[id]) status[id] = { money: 0, inventory: {}, messages: 0 };
  return status[id];
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

/* ===================== COMMANDS ===================== */
const commands = [
  new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),

  new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Vender reliquias")
    .addStringOption(o =>
      o.setName("modo")
        .setDescription("Modo")
        .setRequired(true)
        .addChoices(
          { name: "Uno", value: "one" },
          { name: "Todo", value: "all" }
        )
    ),

  new SlashCommandBuilder()
    .setName("setreliquiechannel")
    .setDescription("Configurar canal de reliquias")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("rankup")
    .setDescription("Subir de rango")
];

/* ===================== REST ===================== */
const rest = new REST({ version: "10" }).setToken(TOKEN);

/* ===================== READY ===================== */
client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log(`🟢 Conectado como ${client.user.tag}`);
});

/* ===================== INTERACTIONS ===================== */
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isChannelSelectMenu() && !interaction.isStringSelectMenu()) return;

  /* === SET CHANNEL === */
  if (interaction.isChatInputCommand() && interaction.commandName === "setreliquiechannel") {
    const menu = new ChannelSelectMenuBuilder()
      .setCustomId("set_reliquie")
      .addChannelTypes(ChannelType.GuildText);

    return interaction.reply({
      ephemeral: true,
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === "set_reliquie") {
    config.channels.reliquies = interaction.values[0];
    saveConfig();

    return interaction.update({
      content: "📜 Canal configurado",
      components: []
    });
  }

  /* === INVENTORY === */
  if (interaction.commandName === "inventory") {
    const user = getStatus(interaction.user.id);
    if (!Object.keys(user.inventory).length)
      return interaction.reply({ ephemeral: true, content: "🎒 Vacío" });

    const list = Object.values(user.inventory)
      .map(i => `${i.icon} ${i.name} x${i.qty}`)
      .join("\n");

    return interaction.reply({ ephemeral: true, content: list });
  }

  /* === MONEY === */
  if (interaction.commandName === "mymoney") {
    const user = getStatus(interaction.user.id);
    return interaction.reply({ ephemeral: true, content: `💰 ${user.money}` });
  }

  /* === SELL === */
  if (interaction.commandName === "sell") {
    const user = getStatus(interaction.user.id);
    const mode = interaction.options.getString("modo");

    if (!Object.keys(user.inventory).length)
      return interaction.reply({ ephemeral: true, content: "❌ No tienes objetos" });

    if (mode === "all") {
      let gain = 0;
      for (const i of Object.values(user.inventory)) {
        gain += (i.price || 0) * i.qty;
      }
      user.money += gain;
      user.inventory = {};
      saveStatus();

      return interaction.reply({ ephemeral: true, content: `💰 Ganaste ${gain}` });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId("sell_one")
      .addOptions(Object.values(user.inventory).map(i => ({
        label: i.name,
        value: i.name
      })));

    return interaction.reply({
      ephemeral: true,
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "sell_one") {
    const name = interaction.values[0];
    const user = getStatus(interaction.user.id);
    const item = user.inventory[name];

    item.qty--;
    user.money += item.price || 0;

    if (item.qty <= 0) delete user.inventory[name];

    saveStatus();

    return interaction.update({ content: `💰 Vendido ${name}`, components: [] });
  }

  /* === RANKUP === */
  if (interaction.commandName === "rankup") {
    const member = interaction.member;
    const st = getStatus(member.id);

    const order = ["bell","silbato_rojo","silbato_azul","silbato_lunar","silbato_negro","silbato_blanco"];
    const costs = [100,250,500,750,1500,3000];

    let index = -1;
    for (let i = order.length - 1; i >= 0; i--) {
      if (member.roles.cache.has(ranks[order[i]])) {
        index = i;
        break;
      }
    }

    if (index === order.length - 1)
      return interaction.reply({ ephemeral: true, content: "Máximo rango" });

    const next = order[index + 1];
    const cost = costs[index + 1];

    if (st.money < cost)
      return interaction.reply({ ephemeral: true, content: `Necesitas ${cost}` });

    st.money -= cost;
    await member.roles.add(ranks[next]);

    saveStatus();

    return interaction.reply({ content: `Subiste a ${next}` });
  }
});

/* ===================== DROP SYSTEM ===================== */
client.on(Events.MessageCreate, message => {
  if (message.author.bot || !message.guild) return;
  if (message.channel.id !== config.channels.reliquies) return;

  const user = getStatus(message.author.id);
  user.messages++;

  if (user.messages % 10 !== 0) return;

  const roll = Math.random() * 100;

  let pool;
  if (roll < 60) pool = objects.class4;
  else if (roll < 85) pool = objects.class3;
  else if (roll < 95) pool = objects.class2;
  else if (roll < 99) pool = objects.special;
  else pool = objects.ultra;

  if (!pool.length) return;

  const item = pool[Math.floor(Math.random() * pool.length)];

  if (!user.inventory[item.name])
    user.inventory[item.name] = { ...item, qty: 0 };

  user.inventory[item.name].qty++;
  saveStatus();

  message.reply(`🧭 Encontraste ${item.icon} ${item.name}`);
});

/* ===================== LOGIN ===================== */
client.login(TOKEN);

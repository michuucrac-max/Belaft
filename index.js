import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import fs from "fs";
import http from "http";

// =====================
// ENV
// =====================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

if (!TOKEN || !CLIENT_ID) {
  console.error("Faltan variables de entorno");
  process.exit(1);
}

// =====================
// KEEP ALIVE SERVER (24/7)
// =====================
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Belaf sigue observando el Abismo.\n");
}).listen(PORT, () => {
  console.log(`🌐 Servidor activo en el puerto ${PORT}`);
});

// =====================
// CLIENT
// =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

// =====================
// LOAD FILES
// =====================
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
const objects = JSON.parse(fs.readFileSync("objects.json", "utf8"));

const objectsMap = {};
Object.values(objects).flat().forEach(o => {
  objectsMap[o.name] = o;
});

let users = fs.existsSync("users.json")
  ? JSON.parse(fs.readFileSync("users.json", "utf8"))
  : {};

const saveUsers = () =>
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));

// =====================
// USER INIT
// =====================
function getUser(id) {
  if (!users[id]) {
    users[id] = {
      money: 0,
      rank: "bell",
      inventory: {},
      messages: 0
    };
    saveUsers();
  }
  return users[id];
}

// =====================
// DROP SYSTEM
// =====================
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  if (!config.channels.find.includes(message.channel.id)) return;

  const user = getUser(message.author.id);
  user.messages++;

  if (user.messages % 5 !== 0) {
    saveUsers();
    return;
  }

  const index = config.channels.find.indexOf(message.channel.id);
  let pool = objects.class4;
  if (index >= 1) pool = objects.class3;
  if (index >= 2) pool = objects.class2;
  if (index >= 3) pool = objects.class1;
  if (index >= 4) pool = objects.special;

  const item = pool[Math.floor(Math.random() * pool.length)];

  user.inventory[item.name] ??= { item, qty: 0 };
  user.inventory[item.name].qty++;

  saveUsers();

  message.reply(`🧭 **Belaf murmura:** Has encontrado **${item.name}**.`);
});

// =====================
// SLASH COMMANDS
// =====================
const commands = [
  new SlashCommandBuilder().setName("inventory").setDescription("Ver tu inventario"),
  new SlashCommandBuilder().setName("sell").setDescription("Vender todas tus reliquias"),
  new SlashCommandBuilder().setName("rankup").setDescription("Ascender de silbato"),
  new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Proponer un trueque")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("give").setRequired(true))
    .addStringOption(o => o.setName("want").setRequired(true))
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

// =====================
// TOPS SYSTEM
// =====================
function sendTops(client) {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  const channel = guild.channels.cache.get(config.channels.tops);
  if (!channel) return;

  const sorted = Object.entries(users)
    .sort((a, b) => b[1].money - a[1].money)
    .slice(0, 10);

  if (!sorted.length) return;

  const text = sorted.map(([id, u], i) => {
    const m = guild.members.cache.get(id);
    return `**${i + 1}.** ${m?.user.username ?? "??"} — 💰 ${u.money} — 🎖️ ${u.rank}`;
  }).join("\n");

  channel.send(`@everyone\n🏆 **Tops del Abismo**\n\n${text}`);
}

// =====================
// READY
// =====================
client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("👁️ Belaf observa el Abismo");

  setInterval(() => sendTops(client), 5 * 60 * 1000);
});

// =====================
// INTERACTIONS
// =====================
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const user = getUser(interaction.user.id);

  if (interaction.commandName === "inventory") {
    const items = Object.values(user.inventory);
    if (!items.length) return interaction.reply("🎒 Vacío.");
    return interaction.reply(items.map(e => `• ${e.item.name} x${e.qty}`).join("\n"));
  }

  if (interaction.commandName === "sell") {
    if (interaction.channel.id !== config.channels.sell)
      return interaction.reply({ content: "Aquí no.", ephemeral: true });

    let total = 0;
    for (const e of Object.values(user.inventory))
      total += e.item.value * e.qty;

    user.inventory = {};
    user.money += total;
    saveUsers();

    return interaction.reply(`💰 Obtienes **${total}** monedas.`);
  }

  if (interaction.commandName === "rankup") {
    if (interaction.channel.id !== config.channels.rankup)
      return interaction.reply({ content: "No aquí.", ephemeral: true });

    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (member.roles.cache.some(r =>
      r.name.toLowerCase().includes(config.roles.narehate.toLowerCase())
    )) {
      return interaction.reply("🩸 Los Narehates no ascienden.");
    }

    const idx = config.ranks.indexOf(user.rank);
    if (idx === -1 || idx === config.ranks.length - 1)
      return interaction.reply("No puedes ascender más.");

    user.rank = config.ranks[idx + 1];
    saveUsers();

    return interaction.reply(`🎖️ Nuevo rango: **${user.rank}**`);
  }
});

// =====================
client.login(TOKEN);

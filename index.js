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
  ChannelType
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
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

/* =====================
   FILES
===================== */
let config = JSON.parse(fs.readFileSync("config.json", "utf8"));
const objects = JSON.parse(fs.readFileSync("objects.json", "utf8"));

let users = fs.existsSync("users.json")
  ? JSON.parse(fs.readFileSync("users.json", "utf8"))
  : {};

const saveUsers = () =>
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));

const saveConfig = () =>
  fs.writeFileSync("config.json", JSON.stringify(config, null, 2));

/* =====================
   HELPERS
===================== */
function getUser(id) {
  if (!users[id]) {
    users[id] = { money: 0, inventory: {}, messages: 0 };
    saveUsers();
  }
  return users[id];
}

function isNarehate(member) {
  return member.roles.cache.has(config.roles.narehate);
}

function getRankFromRoles(member) {
  for (const r of config.ranks) {
    if (member.roles.cache.has(config.roles[r])) return r;
  }
  return "bell";
}

/* =====================
   DROP SYSTEM (7 CANALES)
===================== */
client.on(Events.MessageCreate, message => {
  if (message.author.bot || !message.guild) return;
  if (!config.channels.find?.includes(message.channel.id)) return;

  const user = getUser(message.author.id);
  user.messages++;

  if (user.messages % 5 !== 0) return saveUsers();

  const index = config.channels.find.indexOf(message.channel.id);

  const pools = [
    objects.class4,
    objects.class3,
    objects.class2,
    objects.class1,
    objects.special,
    objects.special,
    objects.ilblu
  ];

  let chance = index === 6 ? 0.067 : 1;
  if (isNarehate(message.member)) {
    chance += index === 6 ? 0.067 : 0.056;
  }

  if (Math.random() > chance) return;

  const pool = pools[index];
  if (!pool?.length) return;

  const item = pool[Math.floor(Math.random() * pool.length)];

  user.inventory[item.name] ??= { ...item, qty: 0 };
  user.inventory[item.name].qty++;
  saveUsers();

  message.reply(
    index === 6
      ? `🏛️ **Ilblu susurra:** ${item.icon} **${item.name}**`
      : `🧭 **Belaf murmura:** ${item.icon} **${item.name}**`
  );
});

/* =====================
   SLASH COMMANDS
===================== */
const commands = [
  new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),
  new SlashCommandBuilder().setName("rankup").setDescription("Subir de rango"),
  new SlashCommandBuilder().setName("trade").setDescription("Intercambiar"),

  new SlashCommandBuilder().setName("setchannelreliquies").setDescription("Canales de reliquias").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchannellevelup").setDescription("Canal de rankup").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchanneltops").setDescription("Canal tops").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchanneltrade").setDescription("Canal trade").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchannelsell").setDescription("Canal ventas").setDefaultMemberPermissions(0)
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* =====================
   READY
===================== */
client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  setInterval(sendTops, 5 * 60 * 1000);
  console.log("🧭 Belaf despierta");
});

/* =====================
   TOPS
===================== */
function sendTops() {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  const channel = guild.channels.cache.get(config.channels.tops);
  if (!channel) return;

  const list = Object.entries(users).map(([id, u]) => {
    const m = guild.members.cache.get(id);
    if (!m) return null;
    return {
      name: m.user.username,
      money: u.money,
      items: Object.values(u.inventory).reduce((a,b)=>a+b.qty,0)
    };
  }).filter(Boolean);

  const top = list.sort((a,b)=>b.money-a.money).slice(0,5);

  channel.send(
    "🏆 **Tops del Abismo**\n" +
    top.map((u,i)=>`${i+1}. ${u.name} — 💰 ${u.money}`).join("\n")
  );
}

/* =====================
   INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {

  if (interaction.isChatInputCommand() &&
      interaction.commandName.startsWith("setchannel")) {

    const key = interaction.commandName.replace("setchannel", "");
    const multi = key === "reliquies";

    const menu = new ChannelSelectMenuBuilder()
      .setCustomId(`set_${key}`)
      .setMinValues(1)
      .setMaxValues(multi ? 7 : 1)
      .addChannelTypes(ChannelType.GuildText);

    return interaction.reply({
      content: "Selecciona canal",
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true
    });
  }

  if (interaction.isChannelSelectMenu()) {
    const key = interaction.customId.replace("set_", "");
    config.channels[key] = interaction.values.length > 1
      ? interaction.values
      : interaction.values[0];

    saveConfig();
    return interaction.reply({ content: "✅ Canal guardado", ephemeral: true });
  }

  if (!interaction.isChatInputCommand()) return;

  const user = getUser(interaction.user.id);

  if (interaction.commandName === "inventory") {
    return interaction.reply({
      content: Object.values(user.inventory).map(i=>`${i.icon} ${i.name} x${i.qty}`).join("\n") || "Vacío",
      ephemeral: true
    });
  }

  if (interaction.commandName === "mymoney") {
    return interaction.reply({ content: `💰 ${user.money}`, ephemeral: true });
  }

  if (interaction.commandName === "rankup") {
    if (isNarehate(interaction.member))
      return interaction.reply({ content: "🧬 Los Narehate no suben de rango.", ephemeral: true });

    if (interaction.channelId !== config.channels.levelup)
      return interaction.reply({ content: "🚫 Canal incorrecto.", ephemeral: true });

    return interaction.reply("🎖️ Sistema de rankup funcionando.");
  }

  if (interaction.commandName === "trade") {
    return interaction.reply({ content: "🔁 Trade base listo.", ephemeral: true });
  }
});

client.login(TOKEN);

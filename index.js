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
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
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

const pendingTrades = new Map();

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
  for (const [rank, roleId] of Object.entries(config.roles)) {
    if (member.roles.cache.has(roleId)) return rank;
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

  const member = message.member;
  if (isNarehate(member)) chance += 0.067;

  if (Math.random() > chance) return;

  const pool = pools[index];
  if (!pool?.length) return;

  const raw = pool[Math.floor(Math.random() * pool.length)];
  const item = {
    name: raw.name ?? "Artefacto desconocido",
    icon: raw.icon ?? "❓"
  };

  user.inventory[item.name] ??= { ...item, qty: 0 };
  user.inventory[item.name].qty++;

  saveUsers();

  message.reply(
    index === 6
      ? `🏛️ **Ilblu susurra:** obtuviste **${item.icon} ${item.name}**`
      : `🧭 **Belaf murmura:** encontraste **${item.icon} ${item.name}**`
  );
});

/* =====================
   SLASH COMMANDS
===================== */
const commands = [
  new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),
  new SlashCommandBuilder().setName("trade").setDescription("Trade con un Narehate"),
  new SlashCommandBuilder().setName("rankup").setDescription("Subir de rango"),

  new SlashCommandBuilder().setName("setchannelreliquies").setDescription("Canales reliquias").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchanneltops").setDescription("Canal tops").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchanneltrade").setDescription("Canal trade").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchannelsell").setDescription("Canal ventas").setDefaultMemberPermissions(0)
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* =====================
   TOPS (cada 5 min)
===================== */
function sendTops() {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  const channel = guild.channels.cache.get(config.channels.tops);
  if (!channel) return;

  const members = guild.members.cache
    .filter(m => !m.user.bot)
    .map(m => {
      const u = users[m.id];
      if (!u) return null;
      return {
        name: m.user.username,
        money: u.money,
        items: Object.values(u.inventory).reduce((a,b)=>a+b.qty,0),
        rank: getRankFromRoles(m)
      };
    })
    .filter(Boolean);

  if (!members.length) return;

  const topMoney = [...members].sort((a,b)=>b.money-a.money).slice(0,10);
  const topItems = [...members].sort((a,b)=>b.items-a.items).slice(0,10);

  channel.send({
    content:
`@everyone
🏆 **Tops del Abismo**

💰 **Dinero**
${topMoney.map((u,i)=>`${i+1}. ${u.name} — ${u.money}`).join("\n")}

🎒 **Reliquias**
${topItems.map((u,i)=>`${i+1}. ${u.name} — ${u.items}`).join("\n")}`
  });
}

/* =====================
   READY
===================== */
client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  setInterval(sendTops, 5 * 60 * 1000);
  console.log("🧭 Belaf despierta");
});

/* =====================
   INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {

  if (!interaction.isChatInputCommand()) return;
  const user = getUser(interaction.user.id);
  const member = interaction.member;

if (interaction.commandName === "rankup") {

  // 🚫 Bloqueo total para Narehates
  if (isNarehate(member)) {
    return interaction.reply({
      content: "🧬 Como **Narehate**, ya no puedes ascender de silbato.",
      ephemeral: true
    });
  }

  const current = getRankFromRoles(member);

  const nextRankIndex = config.ranks.indexOf(current) + 1;
  const nextRank = config.ranks[nextRankIndex];

  if (!nextRank)
    return interaction.reply({
      content: "❌ Ya estás en el rango máximo.",
      ephemeral: true
    });

  const req = config.rankRequirements[nextRank];
  if (!req)
    return interaction.reply({
      content: "⚠️ Requisitos no configurados para este rango.",
      ephemeral: true
    });

  if (user.money < req.money)
    return interaction.reply({
      content: `💰 Necesitas **${req.money} monedas**.`,
      ephemeral: true
    });

  if (!user.inventory[req.item])
    return interaction.reply({
      content: `🎒 Necesitas el objeto **${req.item}**.`,
      ephemeral: true
    });

  // 🔻 Pago
  user.money -= req.money;
  user.inventory[req.item].qty--;
  if (user.inventory[req.item].qty <= 0)
    delete user.inventory[req.item];

  // 🎖️ Cambio de rol
  const oldRole = config.roles[current];
  const newRole = config.roles[nextRank];

  if (oldRole) await member.roles.remove(oldRole);
  if (newRole) await member.roles.add(newRole);

  saveUsers();

  return interaction.reply({
    content: `🎖️ Has ascendido a **${nextRank.replace("_", " ").toUpperCase()}**`
  });
)
}):

client.login(TOKEN);

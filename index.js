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
function getUser(id, member = null) {
  if (!users[id]) {
    users[id] = {
      money: 0,
      rank: "bell",
      humanity: true,
      inventory: {},
      messages: 0
    };
  }

  if (member) {
    const roleOrder = [
      "bell",
      "silbato_rojo",
      "silbato_azul",
      "silbato_lunar",
      "silbato_negro",
      "silbato_blanco",
      "narehate"
    ];

    const names = member.roles.cache.map(r => r.name);
    const found = [...roleOrder].reverse().find(r => names.includes(r));
    if (found) users[id].rank = found;
  }

  updateHumanity(users[id]);
  saveUsers();
  return users[id];
}

function updateHumanity(user) {
  const noHuman = [
    "silbato_rojo",
    "silbato_azul",
    "silbato_lunar",
    "silbato_negro",
    "silbato_blanco",
    "narehate"
  ];
  user.humanity = !noHuman.includes(user.rank);
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

  message.reply(`🧭 Encontraste ${item.icon} **${item.name}**`);
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
      o.setName("mode")
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
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("🧭 Belaf despierta");

  setInterval(() => {
    if (!config.channels.tops) return;
    const ch = client.channels.cache.get(config.channels.tops);
    if (!ch) return;

    const topMoney = Object.entries(users)
      .sort(([, a], [, b]) => b.money - a.money)
      .slice(0, 5)
      .map(([id, u], i) => `#${i + 1} <@${id}> [${u.rank}] — ${u.money} 💰`)
      .join("\n");

    const topRelics = Object.entries(users)
      .map(([id, u]) => ({
        id,
        qty: Object.values(u.inventory).reduce((s, o) => s + o.qty, 0),
        rank: u.rank
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
      .map((u, i) => `#${i + 1} <@${u.id}> [${u.rank}] — ${u.qty} reliquias`)
      .join("\n");

    ch.send({
      content:
        `🏆 **TOP EXPLORADORES** 🏆\n\n` +
        `💰 **Dinero**\n${topMoney || "Sin datos"}\n\n` +
        `🎒 **Reliquias**\n${topRelics || "Sin datos"}`
    });
  }, 10 * 60 * 1000);
});

client.login(TOKEN);

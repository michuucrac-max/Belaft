import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  EmbedBuilder
} from "discord.js";
import fs from "fs";
import express from "express";

/* =====================
ENV
===================== */
const TOKEN = process.env.TOKEN;
const PORT = process.env.PORT || 3000;
const PREFIX = "b!";

if (!TOKEN) {
  console.error("❌ Falta TOKEN en variables de entorno");
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
READY
===================== */
client.once(Events.ClientReady, () => {
  console.log(`🧭 Bot listo como ${client.user.tag}`);
});

/* =====================
COMANDOS CON PREFIJO
===================== */
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const user = getStatus(message.author.id);

  if (command === "inventory") {
    if (!Object.keys(user.inventory).length) {
      return message.reply("🎒 Inventario vacío");
    }
    const list = Object.values(user.inventory)
      .map(i => `${i.icon} ${i.name} x${i.qty}`)
      .join("\n");
    return message.reply(`🎒 INVENTARIO\n${list}`);
  }

  if (command === "mymoney") {
    return message.reply(`💰 ${user.money} monedas`);
  }

  if (command === "sell") {
    const mode = args[0];
    if (!Object.keys(user.inventory).length) {
      return message.reply("❌ No tienes objetos");
    }
    if (mode === "all") {
      let gain = 0;
      for (const i of Object.values(user.inventory)) {
        gain += (i.price ?? 0) * i.qty;
      }
      user.money += gain;
      user.inventory = {};
      saveStatus();
      return message.reply(`💰 Vendiste todo por ${gain} monedas`);
    }
    return message.reply("❌ Usa `b!sell all` para vender todo");
  }

  if (command === "rankup") {
    // Aquí va la lógica de rankup adaptada
    return message.reply("✨ Sistema de rankup aún en desarrollo");
  }

  if (command === "setmoney") {
    if (!message.member.permissions.has("Administrator")) {
      return message.reply("❌ No tienes permisos");
    }
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount)) {
      return message.reply("❌ Uso: b!setmoney @usuario cantidad");
    }
    const st = getStatus(target.id);
    st.money += amount;
    saveStatus();
    return message.reply(`💰 ${target.tag} ahora tiene ${st.money} monedas`);
  }

  if (command === "removemoney") {
    if (!message.member.permissions.has("Administrator")) {
      return message.reply("❌ No tienes permisos");
    }
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount)) {
      return message.reply("❌ Uso: b!removemoney @usuario cantidad");
    }
    const st = getStatus(target.id);
    st.money = Math.max(0, st.money - amount);
    saveStatus();
    return message.reply(`💰 ${target.tag} ahora tiene ${st.money} monedas`);
  }

  if (command === "seemoney") {
    if (!message.member.permissions.has("Administrator")) {
      return message.reply("❌ No tienes permisos");
    }
    const target = message.mentions.users.first();
    if (!target) {
      return message.reply("❌ Uso: b!seemoney @usuario");
    }
    const st = getStatus(target.id);
    return message.reply(`💰 ${target.tag} tiene ${st.money} monedas`);
  }
});

/* =====================
DROPS POR PROBABILIDAD
===================== */
client.on(Events.MessageCreate, async message => {
  try {
    if (message.author.bot || !message.guild) return;
    if (!config.channels.reliquies) return;
    if (message.channel.id !== config.channels.reliquies) return;

    const user = getStatus(message.author.id);

    if (Date.now() - user.lastDrop < 4000) return;
    user.lastDrop = Date.now();

    if (Math.random() > 0.10) return;

    const r = Math.random();
    let pool;
    if (r < 0.5) pool = objects.class4;
    else if (r < 0.75) pool = objects.class3;
    else if (r < 0.9) pool = objects.class2;
    else if (r < 0.97) pool = objects.class1;
    else if (r < 0.995) pool = objects.special;
    else pool = objects.ultra;

    if (!pool.length) return;

    const item = pool[Math.floor(Math.random() * pool.length)];
    if (!user.inventory[item.name])
      user.inventory[item.name] = { ...item, qty: 0 };
    user.inventory[item.name].qty++;
    saveStatus();

    try {
      await message.author.send(`🧭 Encontraste ${item.icon} ${item.name}`);
    } catch {
      message.channel.send(`⚠️ ${message.author}, abre tus DMs`).catch(() => {});
    }
  } catch (err) {
    console.error("❌ Error drop:", err);
  }
});

/* =====================
LOGIN
===================== */
client.login(TOKEN);

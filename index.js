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
import express from "express";

/* =====================
   LOAD FILES
===================== */
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
const items = JSON.parse(fs.readFileSync("items.json", "utf8"));

let users = fs.existsSync("users.json")
  ? JSON.parse(fs.readFileSync("users.json", "utf8"))
  : {};

const saveUsers = () =>
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));

/* =====================
   EXPRESS
===================== */
const app = express();
app.get("/", (_, res) => res.send("Belaf observa el Abismo 🧭"));
app.listen(process.env.PORT || 3000);

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
   HELPERS
===================== */
function getUser(id) {
  if (!users[id]) {
    users[id] = {
      money: 0,
      inventory: {},
      messages: 0
    };
    saveUsers();
  }
  return users[id];
}

function isNarehate(member) {
  return member.roles.cache.has(config.roles.narehate);
}

function isHuman(member) {
  return !isNarehate(member);
}

function getRank(member) {
  if (isNarehate(member)) return "narehate";
  for (const r of config.ranks) {
    if (member.roles.cache.has(config.roles[r])) return r;
  }
  return "bell";
}

/* =====================
   DROP SYSTEM
===================== */
client.on(Events.MessageCreate, msg => {
  if (msg.author.bot || !msg.guild) return;
  if (!config.channels.find.includes(msg.channel.id)) return;

  const user = getUser(msg.author.id);
  user.messages++;

  if (user.messages % 5 !== 0) {
    saveUsers();
    return;
  }

  // 🔮 LEGENDARIO
  if (Math.random() < items.legendary.chance) {
    user.inventory[items.legendary.name] ??= {
      ...items.legendary,
      qty: 0
    };
    user.inventory[items.legendary.name].qty++;
    saveUsers();

    return msg.channel.send(
      `@everyone 💎 **MILAGRO DEL ABISMO** 💎\n` +
      `**${msg.author.username}** obtuvo **${items.legendary.icon} ${items.legendary.name}**`
    );
  }

  const pool = [...items.normal, ...items.special];
  const item = pool[Math.floor(Math.random() * pool.length)];

  user.inventory[item.name] ??= { ...item, qty: 0 };
  user.inventory[item.name].qty++;
  saveUsers();

  msg.reply(`🧭 Encontraste ${item.icon} **${item.name}**`);
});

/* =====================
   TOPS (cada 2 min)
===================== */
async function sendTops() {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  await guild.members.fetch();

  const list = Object.entries(users)
    .map(([id, u]) => {
      const m = guild.members.cache.get(id);
      if (!m) return null;
      return {
        name: m.user.username,
        money: u.money,
        items: Object.values(u.inventory).reduce((a, b) => a + b.qty, 0),
        rank: getRank(m)
      };
    })
    .filter(Boolean);

  const channel = guild.channels.cache.get(config.channels.tops);
  if (!channel) return;

  channel.send(
`@everyone
🏆 **Tops del Abismo**

💰 **Dinero**
${list.sort((a,b)=>b.money-a.money).slice(0,5).map((u,i)=>`${i+1}. ${u.name} — ${u.money}`).join("\n")}

📦 **Objetos**
${list.sort((a,b)=>b.items-a.items).slice(0,5).map((u,i)=>`${i+1}. ${u.name} — ${u.items}`).join("\n")}

🎖️ **Rango**
${list.sort((a,b)=>config.ranks.indexOf(b.rank)-config.ranks.indexOf(a.rank)).slice(0,5).map((u,i)=>`${i+1}. ${u.name} — ${u.rank}`).join("\n")}
`
  );
}

/* =====================
   SLASH COMMANDS REGISTRO
===================== */
const commands = [
  new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Intercambia objetos con un Narehate")
    .addUserOption(o =>
      o.setName("usuario")
       .setDescription("Narehate con quien comerciar")
       .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("rankup")
    .setDescription("Subir de rango")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

/* =====================
   READY
===================== */
client.once(Events.ClientReady, async () => {
  await rest.put(
    Routes.applicationGuildCommands(
      config.clientId,
      config.guildId
    ),
    { body: commands }
  );

  setInterval(sendTops, 2 * 60 * 1000);
  console.log("🧭 Belaf despierta");
});

/* =====================
   INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async i => {

  if (!i.isChatInputCommand()) return;

  /* -------- RANKUP -------- */
  if (i.commandName === "rankup") {
    if (isNarehate(i.member)) {
      return i.reply({
        content:
        "🧬 Ya has llegado al final del camino.\n" +
        "No necesitas subir de rango… eso requiere humanidad.",
        ephemeral: true
      });
    }

    return i.reply("🎖️ Sistema de rankup listo (costos luego).");
  }

  /* -------- TRADE -------- */
  if (i.commandName === "trade") {
    const target = i.options.getUser("usuario");
    if (!target || target.id === i.user.id) {
      return i.reply({ content: "❌ Trade inválido.", ephemeral: true });
    }

    const human = i.member;
    const nare = await i.guild.members.fetch(target.id);

    if (!(isHuman(human) && isNarehate(nare))) {
      return i.reply({
        content:
        "🚫 **Regla del Abismo**\n" +
        "Solo humanos pueden comerciar con Narehates.",
        ephemeral: true
      });
    }

    const hUser = getUser(human.id);
    const nUser = getUser(nare.id);

    const hItem = Object.values(hUser.inventory).find(i=>!i.soulbound);
    const nItem = Object.values(nUser.inventory).find(i=>!i.soulbound);

    if (!hItem || !nItem) {
      return i.reply({ content: "❌ Uno no tiene objetos intercambiables.", ephemeral: true });
    }

    hUser.inventory[hItem.name].qty--;
    nUser.inventory[nItem.name].qty--;

    hUser.inventory[nItem.name] ??= { ...nItem, qty: 0 };
    nUser.inventory[hItem.name] ??= { ...hItem, qty: 0 };

    hUser.inventory[nItem.name].qty++;
    nUser.inventory[hItem.name].qty++;

    saveUsers();

    return i.reply(
`✅ **Intercambio completado**
👤 Humano recibió: ${nItem.icon} ${nItem.name}
🧬 Narehate recibió: ${hItem.icon} ${hItem.name}`
    );
  }
});

client.login(process.env.TOKEN);

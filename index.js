import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

import fs from "fs";
import express from "express";

/* =====================
   LOAD FILES
===================== */
const config = JSON.parse(fs.readFileSync("config.json"));
const items = JSON.parse(fs.readFileSync("items.json"));
const casino = JSON.parse(fs.readFileSync("casino.json"));

let users = fs.existsSync("users.json")
  ? JSON.parse(fs.readFileSync("users.json"))
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
      messages: 0,
      isNarehate: false
    };
    saveUsers();
  }
  return users[id];
}

function hasRole(member, role) {
  return member.roles.cache.has(config.roles[role]);
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
    if (hasRole(member, r)) return r;
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

  if (Math.random() < items.legendary.chance) {
    user.inventory[items.legendary.name] = {
      ...items.legendary,
      qty: 1
    };
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
   TOPS
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
   READY
===================== */
client.once(Events.ClientReady, () => {
  setInterval(sendTops, 2 * 60 * 1000);
  console.log("🧭 Belaf despierta");
});

/* =====================
   INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async i => {

  /* -------- SLASH COMMANDS -------- */
  if (i.isChatInputCommand()) {
    if (i.commandName === "trade") {
      const target = i.options.getUser("usuario");
      if (!target || target.id === i.user.id) {
        return i.reply({ content: "❌ Trade inválido.", ephemeral: true });
      }

      const memberA = i.member;
      const memberB = await i.guild.members.fetch(target.id);

      if (!(isHuman(memberA) && isNarehate(memberB))) {
        return i.reply({
          content: "🚫 Solo humanos pueden comerciar con Narehates.",
          ephemeral: true
        });
      }

      const userA = getUser(memberA.id);
      const userB = getUser(memberB.id);

      const itemsA = Object.values(userA.inventory).filter(i=>!i.soulbound)
        .map(i=>`${i.icon} ${i.name} x${i.qty}`).join("\n") || "— Vacío —";

      const itemsB = Object.values(userB.inventory).filter(i=>!i.soulbound)
        .map(i=>`${i.icon} ${i.name} x${i.qty}`).join("\n") || "— Vacío —";

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`trade_accept_${memberA.id}_${memberB.id}`)
          .setLabel("Aceptar")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`trade_cancel_${memberA.id}_${memberB.id}`)
          .setLabel("Cancelar")
          .setStyle(ButtonStyle.Danger)
      );

      return i.reply({
        content:
`🔁 **Intercambio del Abismo**
👤 Humano: ${memberA.user.username}
🧬 Narehate: ${memberB.user.username}

🎒 Humano
${itemsA}

🎒 Narehate
${itemsB}`,
        components: [row]
      });
    }
  }

  /* -------- BOTONES -------- */
  if (i.isButton() && i.customId.startsWith("trade_")) {
    const [ , action, humanId, nareId ] = i.customId.split("_");

    if (![humanId, nareId].includes(i.user.id)) {
      return i.reply({ content: "🚫 No eres parte del trade.", ephemeral: true });
    }

    if (action === "cancel") {
      return i.update({ content: "❌ Trade cancelado.", components: [] });
    }

    if (action === "accept") {
      const human = getUser(humanId);
      const nare = getUser(nareId);

      const hItem = Object.values(human.inventory).find(i=>!i.soulbound);
      const nItem = Object.values(nare.inventory).find(i=>!i.soulbound);

      if (!hItem || !nItem) {
        return i.update({ content: "❌ No hay objetos intercambiables.", components: [] });
      }

      human.inventory[hItem.name].qty--;
      nare.inventory[nItem.name].qty--;

      if (human.inventory[hItem.name].qty <= 0) delete human.inventory[hItem.name];
      if (nare.inventory[nItem.name].qty <= 0) delete nare.inventory[nItem.name];

      human.inventory[nItem.name] ??= { ...nItem, qty: 0 };
      nare.inventory[hItem.name] ??= { ...hItem, qty: 0 };

      human.inventory[nItem.name].qty++;
      nare.inventory[hItem.name].qty++;

      saveUsers();

      return i.update({
        content:
`✅ **Intercambio completado**
👤 Humano recibió: ${nItem.icon} ${nItem.name}
🧬 Narehate recibió: ${hItem.icon} ${hItem.name}`,
        components: []
      });
    }
  }
});

client.login(process.env.TOKEN);

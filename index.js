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
  ButtonStyle,
  ChannelSelectMenuBuilder,
  StringSelectMenuBuilder,
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

if (!TOKEN || !CLIENT_ID) {
  console.error("❌ Faltan variables de entorno");
  process.exit(1);
}

/* =====================
EXPRESS 24/7
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
TRADE MEMORY
===================== */
const pendingTrades = {};

/* =====================
USER INIT
===================== */
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

/* =====================
DROP SYSTEM (6 CANALES)
===================== */
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  if (!config.channels.reliquies?.includes(message.channel.id)) return;

  const user = getUser(message.author.id);
  user.messages++;

  if (user.messages % 5 !== 0) {
    saveUsers();
    return;
  }

  const index = config.channels.reliquies.indexOf(message.channel.id);

  const pools = [
    objects.class4,
    objects.class3,
    objects.class2,
    objects.class1,
    objects.special,
    objects.special
  ];

  const pool = pools[index] || objects.class4;
  let item;

  if (Math.random() <= 0.000001) {
    item = objects.ultra[0];
    message.channel.send(
      `@everyone 🌑 **EL ABISMO HA RESPONDIDO** 🌑\n` +
      `**${message.author.username}** obtuvo ${item.icon} **${item.name}**`
    );
  } else {
    item = pool[Math.floor(Math.random() * pool.length)];
  }

  user.inventory[item.name] ??= {
    name: item.name,
    icon: item.icon,
    qty: 0
  };

  user.inventory[item.name].qty++;
  saveUsers();

  message.reply(
    `🧭 **Belaf murmura:** encontraste ${item.icon} **${item.name}**`
  );
});

/* =====================
SLASH COMMANDS
===================== */
const commands = [
  new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver tus monedas"),
  new SlashCommandBuilder().setName("rankup").setDescription("Ascender de rango"),

  new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Intercambiar reliquias con un Narehate")
    .addUserOption(o =>
      o.setName("usuario")
        .setDescription("Narehate con quien comerciar")
        .setRequired(true)
    ),

  new SlashCommandBuilder().setName("setchannelreliquies").setDescription("Canales de reliquias").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchanneltrade").setDescription("Canal de trade").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchannelsell").setDescription("Canal de venta").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchanneltops").setDescription("Canal de tops").setDefaultMemberPermissions(0)
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* =====================
TOPS
===================== */
function sendTops() {
  const guild = client.guilds.cache.first();
  if (!guild || !config.channels.tops) return;

  const channel = guild.channels.cache.get(config.channels.tops);
  if (!channel) return;

  const members = Object.entries(users)
    .map(([id, data]) => {
      const member = guild.members.cache.get(id);
      if (!member) return null;

      const isNare = member.roles.cache.some(r =>
        r.name.toLowerCase().includes("narehate")
      );

      return {
        name: member.user.username,
        money: data.money,
        items: Object.values(data.inventory).reduce((a, b) => a + b.qty, 0),
        rank: isNare ? "Narehate" : data.rank
      };
    })
    .filter(Boolean);

  if (!members.length) return;

  const topMoney = [...members].sort((a,b)=>b.money-a.money).slice(0,5);
  const topItems = [...members].sort((a,b)=>b.items-a.items).slice(0,5);

  channel.send(
`@everyone
🏆 **Tops del Abismo**

💰 **Más dinero**
${topMoney.map((u,i)=>`${i+1}. ${u.name} — ${u.money}`).join("\n")}

🎒 **Más reliquias**
${topItems.map((u,i)=>`${i+1}. ${u.name} — ${u.items}`).join("\n")}
`
  );
}

/* =====================
READY
===================== */
client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  setInterval(sendTops, 2 * 60 * 1000);
  console.log("🧭 Belaf despierta");
});

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {

  /* ===== SELECT MENUS (CONFIG) ===== */
  if (interaction.isChannelSelectMenu()) {

    if (interaction.customId === "reliquies")
      config.channels.reliquies = interaction.values;

    if (interaction.customId === "trade")
      config.channels.trade = interaction.values[0];

    if (interaction.customId === "sell")
      config.channels.sell = interaction.values[0];

    if (interaction.customId === "tops")
      config.channels.tops = interaction.values[0];

    saveConfig();
    return interaction.update({ content: "📜 **Belaf lo ha registrado.**", components: [] });
  }

  if (!interaction.isChatInputCommand()) return;

  const user = getUser(interaction.user.id);

  /* ===== INVENTORY ===== */
  if (interaction.commandName === "inventory") {
    const items = Object.values(user.inventory);
    if (!items.length)
      return interaction.reply({ content: "🎒 Vacío", ephemeral: true });

    return interaction.reply({
      content: "🎒 **Inventario**\n" +
        items.map(i => `${i.icon} **${i.name}** x${i.qty}`).join("\n"),
      ephemeral: true
    });
  }

  /* ===== MONEY ===== */
  if (interaction.commandName === "mymoney") {
    return interaction.reply({
      content: `💰 Tienes **${user.money}** monedas`,
      ephemeral: true
    });
  }

  /* ===== RANK UP ===== */
  if (interaction.commandName === "rankup") {
    const member = interaction.member;

    if (member.roles.cache.some(r =>
      r.name.toLowerCase().includes("narehate")
    )) {
      return interaction.reply({
        content: "🩸 **Ya has llegado al final del camino.**\nEso necesita humanidad.",
        ephemeral: true
      });
    }

    const currentIndex = config.ranks.indexOf(user.rank);
    const nextRank = config.ranks[currentIndex + 1];
    if (!nextRank)
      return interaction.reply({ content: "🏔️ Ya no puedes subir más.", ephemeral: true });

    const req = config.rankRequirements[nextRank];
    if (user.money < req.money)
      return interaction.reply({ content: `💰 Necesitas ${req.money} monedas.`, ephemeral: true });

    const item = user.inventory[req.item];
    if (!item || item.qty < 1)
      return interaction.reply({ content: `🎒 Necesitas **${req.item}**.`, ephemeral: true });

    user.money -= req.money;
    item.qty--;
    if (item.qty <= 0) delete user.inventory[req.item];
    user.rank = nextRank;
    saveUsers();

    return interaction.reply(`🎖️ Has ascendido a **${nextRank}**`);
  }

  /* ===== TRADE ===== */
  if (interaction.commandName === "trade") {

    if (interaction.channel.id !== config.channels.trade)
      return interaction.reply({ content: "🚫 Canal incorrecto.", ephemeral: true });

    const target = interaction.options.getUser("usuario");
    if (!target || target.id === interaction.user.id)
      return interaction.reply({ content: "❌ Trade inválido.", ephemeral: true });

    const guild = interaction.guild;
    const humanMember = interaction.member;
    const nareMember = await guild.members.fetch(target.id);

    const isHuman = !humanMember.roles.cache.some(r => r.name.toLowerCase().includes("narehate"));
    const isNare = nareMember.roles.cache.some(r => r.name.toLowerCase().includes("narehate"));

    if (!isHuman || !isNare)
      return interaction.reply({ content: "🩸 Solo Humano ↔ Narehate.", ephemeral: true });

    const human = getUser(humanMember.id);
    const nare = getUser(nareMember.id);

    const humanItems = Object.values(human.inventory).filter(i => i.qty > 0);
    const nareItems = Object.values(nare.inventory).filter(i => i.qty > 0);

    const key = `${humanMember.id}_${nareMember.id}`;
    pendingTrades[key] = {};

    return interaction.reply({
      content: "🔁 **Intercambio del Abismo**",
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`trade_human_${key}`)
            .setPlaceholder("Tu reliquia")
            .addOptions(humanItems.map(i => ({
              label: i.name,
              value: i.name,
              emoji: i.icon
            })))
        ,
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`trade_nare_${key}`)
            .setPlaceholder("Reliquia del Narehate")
            .addOptions(nareItems.map(i => ({
              label: i.name,
              value: i.name,
              emoji: i.icon
            })))
        ]
      ]
    });
  }

  /* ===== TRADE SELECT ===== */
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("trade_")) {

    const [, side, humanId, nareId] = interaction.customId.split("_");
    const key = `${humanId}_${nareId}`;
    pendingTrades[key][side] = interaction.values[0];

    if (!pendingTrades[key].human || !pendingTrades[key].nare)
      return interaction.reply({ content: "📦 Seleccionado.", ephemeral: true });

    return interaction.followUp({
      content: "⚠️ Confirmar intercambio",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`trade_accept_${key}`).setLabel("Confirmar").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`trade_cancel_${key}`).setLabel("Cancelar").setStyle(ButtonStyle.Danger)
        )
      ]
    });
  }

  /* ===== TRADE BUTTONS ===== */
  if (interaction.isButton() && interaction.customId.startsWith("trade_")) {

    const [, action, humanId, nareId] = interaction.customId.split("_");
    const key = `${humanId}_${nareId}`;
    const trade = pendingTrades[key];
    if (!trade) return;

    if (action === "cancel") {
      delete pendingTrades[key];
      return interaction.update({ content: "❌ Cancelado.", components: [] });
    }

    const human = getUser(humanId);
    const nare = getUser(nareId);

    const hItem = human.inventory[trade.human];
    const nItem = nare.inventory[trade.nare];

    hItem.qty--;
    nItem.qty--;

    if (hItem.qty <= 0) delete human.inventory[trade.human];
    if (nItem.qty <= 0) delete nare.inventory[trade.nare];

    human.inventory[trade.nare] ??= { ...nItem, qty: 0 };
    nare.inventory[trade.human] ??= { ...hItem, qty: 0 };

    human.inventory[trade.nare].qty++;
    nare.inventory[trade.human].qty++;

    saveUsers();
    delete pendingTrades[key];

    return interaction.update({ content: "✅ **Intercambio completado.**", components: [] });
  }
});

client.login(TOKEN);

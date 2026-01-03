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
  ChannelType,
  StringSelectMenuBuilder
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
DROP SYSTEM
===================== */
client.on(Events.MessageCreate, message => {
  if (message.author.bot || !message.guild) return;
  if (!config.channels?.reliquies?.includes(message.channel.id)) return;

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

  let item;

  if (Math.random() <= 0.000001) {
    item = objects.ultra[0];
    message.channel.send(
      `@everyone 🌑 **EL ABISMO HA RESPONDIDO** 🌑\n` +
      `**${message.author.username}** obtuvo **${item.icon} ${item.name}**`
    );
  } else {
    const pool = pools[index] || objects.class4;
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
    `🧭 **Belaf murmura:** encontraste **${item.icon} ${item.name}**`
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
    .setDescription("Intercambiar reliquias")
    .addUserOption(o => o.setName("user").setDescription("Usuario").setRequired(true)),

  new SlashCommandBuilder().setName("setchannelreliquies").setDescription("Canales reliquias").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchanneltrade").setDescription("Canal trade").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchannelsell").setDescription("Canal venta").setDefaultMemberPermissions(0),
  new SlashCommandBuilder().setName("setchanneltops").setDescription("Canal tops").setDefaultMemberPermissions(0),
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

/* =====================
TOPS
===================== */
function sendTops() {
  const guild = client.guilds.cache.first();
  if (!guild || !config.channels?.tops) return;

  const channel = guild.channels.cache.get(config.channels.tops);
  if (!channel) return;

  const members = Object.entries(users)
    .map(([id, data]) => {
      const member = guild.members.cache.get(id);
      if (!member) return null;

      return {
        name: member.user.username,
        money: data.money,
        items: Object.values(data.inventory).reduce((a, b) => a + b.qty, 0)
      };
    })
    .filter(Boolean);

  const topMoney = [...members].sort((a,b)=>b.money-a.money).slice(0,5);
  const topItems = [...members].sort((a,b)=>b.items-a.items).slice(0,5);

  channel.send(
`🏆 **Tops del Abismo**

💰 **Más dinero**
${topMoney.map((u,i)=>`${i+1}. ${u.name} — ${u.money}`).join("\n")}

🎒 **Más reliquias**
${topItems.map((u,i)=>`${i+1}. ${u.name} — ${u.items}`).join("\n")}
`);
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

  if (interaction.isChannelSelectMenu()) {
    if (interaction.customId === "reliquies") config.channels.reliquies = interaction.values;
    if (interaction.customId === "trade") config.channels.trade = interaction.values[0];
    if (interaction.customId === "sell") config.channels.sell = interaction.values[0];
    if (interaction.customId === "tops") config.channels.tops = interaction.values[0];
    saveConfig();
    return interaction.update({ content: "📜 Registrado.", components: [] });
  }

  if (interaction.isChatInputCommand()) {

  const user = getUser(interaction.user.id);

  /* =====================
  SET CHANNELS
  ===================== */
  if (interaction.commandName === "setchanneltrade") {
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("trade")
        .setPlaceholder("Selecciona el canal de trade")
        .addChannelTypes(ChannelType.GuildText)
    );
    return interaction.reply({
      content: "🔁 Selecciona el canal para **trade**",
      components: [row],
      ephemeral: true
    });
  }

  if (interaction.commandName === "setchannelsell") {
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("sell")
        .setPlaceholder("Selecciona el canal de venta")
        .addChannelTypes(ChannelType.GuildText)
    );
    return interaction.reply({
      content: "💰 Selecciona el canal para **ventas**",
      components: [row],
      ephemeral: true
    });
  }

  if (interaction.commandName === "setchanneltops") {
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("tops")
        .setPlaceholder("Selecciona el canal de tops")
        .addChannelTypes(ChannelType.GuildText)
    );
    return interaction.reply({
      content: "🏆 Selecciona el canal para **tops**",
      components: [row],
      ephemeral: true
    });
  }

  if (interaction.commandName === "setchannelreliquies") {
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("reliquies")
        .setPlaceholder("Selecciona los canales de reliquias")
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(6)
    );
    return interaction.reply({
      content: "🧭 Selecciona **hasta 6 canales** de reliquias",
      components: [row],
      ephemeral: true
    });
  }

  /* INVENTORY */
  if (interaction.commandName === "inventory") {
    const items = Object.values(user.inventory);
    if (!items.length) return interaction.reply({ content: "🎒 Vacío", ephemeral: true });

    return interaction.reply({
      content: items.map(i => `${i.icon} **${i.name}** x${i.qty}`).join("\n"),
      ephemeral: true
    });
  }

  /* MONEY */
  if (interaction.commandName === "mymoney") {
    return interaction.reply({ content: `💰 ${user.money} monedas`, ephemeral: true });
  }

  /* RANKUP */
  if (interaction.commandName === "rankup") {
    const member = interaction.member;

    // Narehates no pueden rankear
    if (member.roles.cache.some(r => r.name.toLowerCase().includes("narehate"))) {
      return interaction.reply({
        content: "🩸 **Un Narehate no posee humanidad para ascender.**",
        ephemeral: true
      });
    }

    const currentIndex = config.ranks.indexOf(user.rank);
    const nextRank = config.ranks[currentIndex + 1];
    if (!nextRank) return interaction.reply({ content: "🏔️ Ya alcanzaste el rango máximo.", ephemeral: true });

    const cost = config.rankCosts[nextRank] || 100;
    if (user.money < cost) return interaction.reply({ content: `💰 Necesitas ${cost} monedas.`, ephemeral: true });

    user.money -= cost;
    user.rank = nextRank;
    saveUsers();

    return interaction.reply(`🎖️ Has ascendido a **${nextRank}**\n💰 Monedas restantes: **${user.money}**`);
  }

  /* TRADE */
  if (interaction.commandName === "trade") {
    if (interaction.channelId !== config.channels.trade)
      return interaction.reply({ content: "❌ No es el canal de trade.", ephemeral: true });

    const target = interaction.options.getUser("user");
    const inventory = Object.values(user.inventory);
    if (!inventory.length) return interaction.reply({ content: "🎒 No tienes objetos para comerciar.", ephemeral: true });

    const options = inventory.map(i => ({
      label: `${i.name} x${i.qty}`,
      value: i.name,
      description: "Selecciona este objeto"
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`trade_item_${target.id}`)
        .setPlaceholder("Selecciona el objeto a intercambiar")
        .addOptions(options)
    );

    return interaction.reply({
      content: `🔁 Selecciona el objeto que quieres ofrecer a **${target.username}**`,
      components: [row],
      ephemeral: true
    });
  }

  /* SELECT MENU DEL OBJETO */
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith("trade_item_")) {
      const targetId = interaction.customId.split("_")[2];
      const itemName = interaction.values[0];

      if (!user.inventory[itemName]) {
        return interaction.reply({ content: "❌ Ya no tienes ese objeto.", ephemeral: true });
      }

      // Trade temporal
      user.pendingTrade = { targetId, item: itemName };
      saveUsers();

      return interaction.update({
        content: `📦 Has seleccionado **${itemName}**. Escribe la cantidad a intercambiar.`,
        components: []
      });
    }
  }

  } // end isChatInputCommand
});

/* =====================
MESSAGE CREATE PARA TRADE
===================== */
client.on(Events.MessageCreate, message => {
  if (!message.guild || message.author.bot) return;

  const userData = users[message.author.id];
  if (!userData?.pendingTrade) return;
  if (message.channel.id !== config.channels.trade) return;

  const amount = parseInt(message.content);
  if (isNaN(amount) || amount <= 0) return;

  const trade = userData.pendingTrade;
  const item = userData.inventory[trade.item];
  const target = getUser(trade.targetId);

  if (!item || item.qty < amount) return message.reply("❌ No tienes esa cantidad.");

  item.qty -= amount;
  if (item.qty <= 0) delete userData.inventory[trade.item];

  target.inventory[trade.item] ??= { name: trade.item, icon: item.icon, qty: 0 };
  target.inventory[trade.item].qty += amount;

  delete userData.pendingTrade;
  saveUsers();

  message.reply(`🔁 Intercambio completado: entregaste **${amount}x ${trade.item}**`);
});

client.login(TOKEN);

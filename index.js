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

// =====================
// ENV
// =====================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error("Faltan variables de entorno");
  process.exit(1);
}

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

// mapa rápido por nombre
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
// DROP SYSTEM (por canal)
// =====================
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  if (!config.channels.find.includes(message.channel.id)) return;

  const user = getUser(message.author.id);
  user.messages++;

  // drop cada 5 mensajes
  if (user.messages % 5 !== 0) {
    saveUsers();
    return;
  }

  // pools según orden del canal
  const index = config.channels.find.indexOf(message.channel.id);

  let pool = objects.class4;
  if (index >= 1) pool = objects.class3;
  if (index >= 2) pool = objects.class2;
  if (index >= 3) pool = objects.class1;
  if (index >= 4) pool = objects.special;

  const item = pool[Math.floor(Math.random() * pool.length)];

  if (!user.inventory[item.name]) {
    user.inventory[item.name] = { item, qty: 1 };
  } else {
    user.inventory[item.name].qty++;
  }

  saveUsers();

  message.reply(
    `🧭 **Belaf murmura:**\nHas encontrado **${item.name}**.`
  );
});

// =====================
// SLASH COMMANDS
// =====================
const commands = [
  new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("Ver tu inventario"),

  new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Vender todas tus reliquias"),

  new SlashCommandBuilder()
    .setName("rankup")
    .setDescription("Ascender de silbato"),

  new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Proponer un trueque a un Narehate")
    .addUserOption(o =>
      o.setName("user").setDescription("Narehate").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("give").setDescription("Objeto que ofreces").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("want").setDescription("Objeto que quieres").setRequired(true)
    )
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

  if (sorted.length === 0) return;

  const text = sorted.map(([id, data], i) => {
    const member = guild.members.cache.get(id);
    const name = member ? member.user.username : "Desconocido";
    return `**${i + 1}.** ${name} — 💰 ${data.money} — 🎖️ ${data.rank}`;
  }).join("\n");

  channel.send({
    content: `@everyone\n🏆 **Tops del Abismo**\n\n${text}`
  });
}

// =====================
// READY
// =====================
client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("Belaf observa el Abismo");

  // tops cada 5 minutos
  setInterval(() => {
    sendTops(client);
  }, 5 * 60 * 1000);
});

// =====================
// INTERACTIONS
// =====================
client.on(Events.InteractionCreate, async interaction => {

  // =================
  // BUTTONS (TRADE)
  // =================
  if (interaction.isButton()) {
    const [type, fromId, give, want] = interaction.customId.split(":");

    if (type === "trade_reject") {
      return interaction.update({
        content: "🔁 **Trueque rechazado.**",
        components: []
      });
    }

    if (type === "trade_accept") {
      const fromUser = getUser(fromId);
      const toUser = getUser(interaction.user.id);

      if (!toUser.inventory[want] || toUser.inventory[want].qty < 1)
        return interaction.reply({ content: "No tienes el objeto solicitado.", ephemeral: true });

      fromUser.inventory[give].qty--;
      if (fromUser.inventory[give].qty <= 0) delete fromUser.inventory[give];

      toUser.inventory[want].qty--;
      if (toUser.inventory[want].qty <= 0) delete toUser.inventory[want];

      fromUser.inventory[want] ??= { item: objectsMap[want], qty: 0 };
      toUser.inventory[give] ??= { item: objectsMap[give], qty: 0 };

      fromUser.inventory[want].qty++;
      toUser.inventory[give].qty++;

      saveUsers();

      return interaction.update({
        content: "🔁 **Belaf asiente:** El trueque ha sido completado.",
        components: []
      });
    }
  }

  if (!interaction.isChatInputCommand()) return;
  const user = getUser(interaction.user.id);

  // INVENTORY
  if (interaction.commandName === "inventory") {
    const items = Object.values(user.inventory);
    if (!items.length) return interaction.reply("🎒 Inventario vacío.");

    const text = items.map(e => `• ${e.item.name} x${e.qty}`).join("\n");
    return interaction.reply(`🎒 **Inventario:**\n${text}`);
  }

  // SELL
  if (interaction.commandName === "sell") {
    if (interaction.channel.id !== config.channels.sell)
      return interaction.reply({ content: "Aquí no.", ephemeral: true });

    let total = 0;
    for (const e of Object.values(user.inventory))
      total += e.item.value * e.qty;

    user.inventory = {};
    user.money += total;
    saveUsers();

    return interaction.reply(
      `💰 **Belaf acepta tus reliquias.**\nObtienes **${total}** monedas.`
    );
  }

  // RANKUP
  if (interaction.commandName === "rankup") {
    if (interaction.channel.id !== config.channels.rankup)
      return interaction.reply({ content: "No aquí.", ephemeral: true });

    const member = await interaction.guild.members.fetch(interaction.user.id);

    // 🚫 Narehates no ascienden
    if (member.roles.cache.some(r =>
      r.name.toLowerCase().includes(config.roles.narehate.toLowerCase())
    )) {
      return interaction.reply(
        "🩸 **Belaf susurra:** Los Narehates ya no ascienden."
      );
    }

    const ranks = config.ranks;
    const idx = ranks.indexOf(user.rank);
    if (idx === -1 || idx === ranks.length - 1)
      return interaction.reply("No puedes ascender más.");

    const nextRank = ranks[idx + 1];
    const req = config.rankRequirements[user.rank];

    if (user.money < req.money)
      return interaction.reply(`Belaf exige **${req.money}** monedas.`);

    const entry = user.inventory[req.item];
    if (!entry || entry.qty < 1)
      return interaction.reply(`Belaf exige **${req.item}**.`);

    user.money -= req.money;
    entry.qty--;
    if (entry.qty <= 0) delete user.inventory[req.item];

    user.rank = nextRank;
    saveUsers();

    const newRole = interaction.guild.roles.cache.find(r =>
      r.name.toLowerCase().includes(nextRank.replace("_", " "))
    );
    if (newRole) await member.roles.add(newRole);

    return interaction.reply(
      `🎖️ **Belaf proclama:** Has ascendido a **${nextRank}**.`
    );
  }

  // TRADE
  if (interaction.commandName === "trade") {
    if (interaction.channel.id !== config.channels.trade)
      return interaction.reply({ content: "No aquí.", ephemeral: true });

    const target = interaction.options.getUser("user");
    const give = interaction.options.getString("give");
    const want = interaction.options.getString("want");

    if (!user.inventory[give])
      return interaction.reply("No tienes ese objeto.");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`trade_accept:${interaction.user.id}:${give}:${want}`)
        .setLabel("Aceptar")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("trade_reject")
        .setLabel("Rechazar")
        .setStyle(ButtonStyle.Danger)
    );

    return interaction.reply({
      content: `🔁 **Belaf anuncia:**  
${target}, **${interaction.user.username}** quiere cambiar su **${give}** por tu **${want}**.`,
      components: [row]
    });
  }
});

// =====================
client.login(TOKEN);

import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  SlashCommandBuilder
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
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// =====================
// LOAD FILES
// =====================
const config = JSON.parse(fs.readFileSync("config.json"));
const objects = JSON.parse(fs.readFileSync("objects.json"));
let users = fs.existsSync("users.json")
  ? JSON.parse(fs.readFileSync("users.json"))
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
      inventory: []
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

  if (Math.random() > 0.1) return; // 10% drop

  const user = getUser(message.author.id);
  const pool = objects.class4;
  const item = pool[Math.floor(Math.random() * pool.length)];

  user.inventory.push(item);
  saveUsers();

  message.reply(
    `🧭 **Belaf susurra:**  
Has encontrado **${item.name}** entre las ruinas del Abismo.`
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
    .setDescription("Vender objetos")
    .addStringOption(o =>
      o.setName("all").setDescription("Vender todo").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("rankup")
    .setDescription("Ascender de rango"),

  new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Intercambiar con un Narehate")
    .addUserOption(o =>
      o.setName("user").setDescription("Narehate").setRequired(true)
    )
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), {
    body: commands
  });
  console.log(`Belaf despierta en el Abismo`);
});

// =====================
// INTERACTIONS
// =====================
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const user = getUser(interaction.user.id);

  // INVENTORY
  if (interaction.commandName === "inventory") {
    const list =
      user.inventory.map(i => `• ${i.name}`).join("\n") || "Vacío";
    return interaction.reply(`🎒 **Inventario:**\n${list}`);
  }

  // SELL
  if (interaction.commandName === "sell") {
    if (interaction.channel.id !== config.channels.sell)
      return interaction.reply({
        content: "Este lugar no acepta intercambios.",
        ephemeral: true
      });

    let total = 0;
    user.inventory.forEach(i => (total += i.value));
    user.inventory = [];
    user.money += total;
    saveUsers();

    return interaction.reply(
      `💰 Belaf acepta tus reliquias. Obtienes **${total}** monedas.`
    );
  }

  // RANKUP
  if (interaction.commandName === "rankup") {
    if (interaction.channel.id !== config.channels.rankup)
      return interaction.reply({
        content: "Aquí no puedes ascender.",
        ephemeral: true
      });

    const ranks = config.ranks;
    const idx = ranks.indexOf(user.rank);
    if (idx === -1 || idx === ranks.length - 1)
      return interaction.reply("No puedes ascender más.");

    user.rank = ranks[idx + 1];
    saveUsers();

    return interaction.reply(
      `🎖️ **Ascenso logrado:** ahora eres **${user.rank}**.`
    );
  }

  // TRADE
  if (interaction.commandName === "trade") {
    if (interaction.channel.id !== config.channels.trade)
      return interaction.reply({
        content: "Los trueques solo ocurren aquí.",
        ephemeral: true
      });

    const target = interaction.options.getUser("user");
    const member = interaction.guild.members.cache.get(target.id);

    if (
      !member.roles.cache.some(r =>
        r.name.includes(config.roles.narehate)
      )
    ) {
      return interaction.reply("Ese usuario no es Narehate.");
    }

    return interaction.reply(
      `🔁 **Belaf anuncia:**  
${interaction.user} desea comerciar con ${target}.`
    );
  }
});

// =====================
// LOGIN
// =====================
client.login(TOKEN);

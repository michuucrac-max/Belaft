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

  if (Math.random() > 0.1) return; // 10%

  const user = getUser(message.author.id);

  let pool = objects.class4;
  if (user.rank === "silbato_rojo") pool = objects.class3;
  if (user.rank === "silbato_azul") pool = objects.class2;
  if (user.rank === "silbato_lunar") pool = objects.class1;
  if (user.rank === "silbato_negro") pool = objects.special;

  const item = pool[Math.floor(Math.random() * pool.length)];
  user.inventory.push(item);
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
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("Belaf observa el Abismo");
});

// =====================
// INTERACTIONS
// =====================
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const user = getUser(interaction.user.id);

  // INVENTORY
  if (interaction.commandName === "inventory") {
    const text =
      user.inventory.map(i => `• ${i.name}`).join("\n") || "Vacío";
    return interaction.reply(`🎒 **Inventario:**\n${text}`);
  }

  // SELL
  if (interaction.commandName === "sell") {
    if (interaction.channel.id !== config.channels.sell)
      return interaction.reply({ content: "Aquí no.", ephemeral: true });

    let total = 0;
    user.inventory.forEach(i => (total += i.value));
    user.inventory = [];
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

  const ranks = config.ranks;
  const idx = ranks.indexOf(user.rank);

  if (idx === -1 || idx === ranks.length - 1)
    return interaction.reply("No puedes ascender más.");

  const nextRank = ranks[idx + 1];
  const req = config.rankRequirements[user.rank];

  if (!req)
    return interaction.reply("Belaf no ha definido este ascenso.");

  // 💰 dinero
  if (user.money < req.money)
    return interaction.reply(
      `Belaf exige **${req.money}** monedas.`
    );

  // 📦 objeto
  const itemIndex = user.inventory.findIndex(
    i => i.name === req.item
  );
  if (itemIndex === -1)
    return interaction.reply(
      `Belaf exige la reliquia **${req.item}**.`
    );

  const member = await interaction.guild.members.fetch(interaction.user.id);

  // quitar rol anterior (por nombre flexible)
  const oldRole = interaction.guild.roles.cache.find(r =>
    r.name.toLowerCase().includes(user.rank.replace("_", " "))
  );
  if (oldRole) await member.roles.remove(oldRole);

  // cobrar
  user.money -= req.money;
  user.inventory.splice(itemIndex, 1);

  // ascenso
  user.rank = nextRank;
  saveUsers();

  // agregar nuevo rol
  const newRole = interaction.guild.roles.cache.find(r =>
    r.name.toLowerCase().includes(nextRank.replace("_", " "))
  );
  if (newRole) await member.roles.add(newRole);

  return interaction.reply(
    `🎖️ **Belaf proclama:**  
Has ascendido a **${nextRank.replace("_", " ")}**.`
  );
}
  
  // TRADE
  if (interaction.commandName === "trade") {
    if (interaction.channel.id !== config.channels.trade)
      return interaction.reply({ content: "No aquí.", ephemeral: true });

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
      `🔁 **Belaf anuncia:**\n${interaction.user} desea comerciar con ${target}.`
    );
  }
});

// =====================
client.login(TOKEN);

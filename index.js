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
  ChannelType,
  SelectMenuBuilder
} from "discord.js";
import fs from "fs";
import express from "express";

// =====================
// ENV
// =====================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

if (!TOKEN || !CLIENT_ID) {
  console.error("Faltan variables de entorno");
  process.exit(1);
}

// =====================
// EXPRESS KEEP-ALIVE
// =====================
const app = express();
app.get("/", (_, res) => res.send("Belaf vigila el Abismo 🧭"));
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));

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
const configPath = "config.json";
const objectsPath = "objects.json";

const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, "utf8"))
  : { channels: { find: [], trade: null, tops: null, sell: null }, ranks: [], rankRequirements: {}, roles: { narehate: "narehate" } };

const objects = fs.existsSync(objectsPath)
  ? JSON.parse(fs.readFileSync(objectsPath, "utf8"))
  : {};

const objectsMap = {};
Object.values(objects).flat().forEach(o => { objectsMap[o.name] = o; });

let users = fs.existsSync("users.json")
  ? JSON.parse(fs.readFileSync("users.json", "utf8"))
  : {};

const saveUsers = () => fs.writeFileSync("users.json", JSON.stringify(users, null, 2));

// =====================
// USER INIT
// =====================
function getUser(id) {
  if (!users[id]) {
    users[id] = { money: 0, rank: "bell", inventory: {}, messages: 0 };
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

  const user = getUser(message.author.id);
  user.messages++;

  if (user.messages % 5 !== 0) { saveUsers(); return; }

  const index = config.channels.find.indexOf(message.channel.id);
  let pool = objects.class4;
  if (index >= 1) pool = objects.class3;
  if (index >= 2) pool = objects.class2;
  if (index >= 3) pool = objects.class1;
  if (index >= 4) pool = objects.special;

  const item = pool[Math.floor(Math.random() * pool.length)];
  if (!user.inventory[item.name]) user.inventory[item.name] = { item, qty: 1 };
  else user.inventory[item.name].qty++;

  saveUsers();
  message.reply(`🧭 **Belaf murmura:**\nHas encontrado **${item.icon || ""} ${item.name}**.`);
});

// =====================
// SLASH COMMANDS
// =====================
const commands = [
  new SlashCommandBuilder().setName("inventory").setDescription("Ver tu inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver tu dinero"),
  new SlashCommandBuilder().setName("sell").setDescription("Vender todas tus reliquias"),
  new SlashCommandBuilder().setName("rankup").setDescription("Ascender de silbato"),
  new SlashCommandBuilder().setName("trade")
    .setDescription("Proponer un trueque a un Narehate")
    .addUserOption(o => o.setName("user").setDescription("Narehate").setRequired(true))
    .addStringOption(o => o.setName("give").setDescription("Objeto que ofreces").setRequired(true))
    .addStringOption(o => o.setName("want").setDescription("Objeto que quieres").setRequired(true)),
  new SlashCommandBuilder().setName("setchannelsreliquie").setDescription("Seleccionar canales de reliquias"),
  new SlashCommandBuilder().setName("setchanneltrade").setDescription("Seleccionar canal de trades"),
  new SlashCommandBuilder().setName("setchanneltop").setDescription("Seleccionar canal de tops"),
  new SlashCommandBuilder().setName("setchannelsell").setDescription("Seleccionar canal de venta")
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

// =====================
// READY
// =====================
client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("Belaf observa el Abismo");
  setInterval(() => sendTops(client), 5*60*1000);
});

// =====================
// TOPS SYSTEM
// =====================
function sendTops(client) {
  const guild = client.guilds.cache.first();
  if (!guild) return;
  const channel = guild.channels.cache.get(config.channels.tops);
  if (!channel) return;

  const usersArray = Object.entries(users);

  const topMoney = usersArray.filter(([id]) => guild.members.cache.has(id))
    .sort((a, b) => b[1].money - a[1].money).slice(0, 10);

  const topItems = usersArray.filter(([id]) => guild.members.cache.has(id))
    .sort((a, b) => Object.values(b[1].inventory).reduce((acc,i)=>acc+i.qty,0) - Object.values(a[1].inventory).reduce((acc,i)=>acc+i.qty,0))
    .slice(0, 10);

  const topRank = usersArray.filter(([id]) => guild.members.cache.has(id))
    .sort((a, b) => config.ranks.indexOf(b[1].rank) - config.ranks.indexOf(a[1].rank))
    .slice(0, 10);

  const formatTop = (arr, key) => arr.map(([id, data], i) => {
    const member = guild.members.cache.get(id);
    const name = member ? member.user.username : "Desconocido";
    return `**${i+1}.** ${name} — ${key==='money'?`💰 ${data.money}`:key==='items'?`📦 ${Object.values(data.inventory).reduce((acc,i)=>acc+i.qty,0)}`:`🎖️ ${data.rank}`}`;
  }).join("\n");

  const text = `@everyone\n🏆 **TOPS DEL ABISMO**\n\n💰 Dinero:\n${formatTop(topMoney,'money')}\n\n📦 Reliquias:\n${formatTop(topItems,'items')}\n\n🎖️ Rango:\n${formatTop(topRank,'rank')}`;
  channel.send({ content: text });
}

// =====================
// INTERACTIONS
// =====================
client.on(Events.InteractionCreate, async interaction => {

  const user = getUser(interaction.user.id);

  // =================
  // PRIVADOS
  // =================
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "inventory") {
      const items = Object.values(user.inventory);
      if (!items.length) return interaction.reply({ content:"🎒 Inventario vacío.", ephemeral:true });
      const text = items.map(e => `• ${e.item.icon || ""} ${e.item.name} x${e.qty}`).join("\n");
      return interaction.reply({ content: `🎒 **Inventario:**\n${text}`, ephemeral:true });
    }

    if (interaction.commandName === "mymoney") {
      return interaction.reply({ content: `💰 Tienes **${user.money}** monedas.`, ephemeral:true });
    }
  }

  // =================
  // CANALES BOTONES (Admin)
  // =================
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName.startsWith("setchannels") || interaction.commandName.startsWith("setchannel")) {
      // Obtener todos los canales de tipo text
      const options = interaction.guild.channels.cache
        .filter(ch => ch.type === ChannelType.GuildText)
        .map(ch => ({ label: ch.name, value: ch.id }));

      if (!options.length) return interaction.reply({ content:"No hay canales disponibles.", ephemeral:true });

      const menu = new ActionRowBuilder().addComponents(
        new SelectMenuBuilder()
          .setCustomId(`select_channel_${interaction.commandName}`)
          .setPlaceholder("Selecciona el canal...")
          .addOptions(options)
      );

      return interaction.reply({ content:"Selecciona el canal:", components:[menu], ephemeral:true });
    }
  }

  // =================
  // SELECT MENU CANALES
  // =================
  if (interaction.isSelectMenu()) {
    const id = interaction.values[0];
    const cmd = interaction.customId.replace("select_channel_","");

    if (cmd === "setchannelsreliquie") {
      config.channels.find = [id]; // podrías permitir múltiples con .push
    } else if (cmd === "setchanneltrade") config.channels.trade = id;
    else if (cmd === "setchanneltop") config.channels.tops = id;
    else if (cmd === "setchannelsell") config.channels.sell = id;

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return interaction.update({ content:`Canal para ${cmd} guardado. ✅`, components:[] });
  }
});

client.login(TOKEN);

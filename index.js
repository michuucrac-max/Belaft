//// BLOQUE 1: IMPORTACIONES ////
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
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} from "discord.js";

import fs from "fs";
import express from "express";

//// BLOQUE 2: VARIABLES DE ENTORNO ////
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

//// BLOQUE 3: EXPRESS ////
const app = express();
app.get("/", (_, res) => res.send("Belaf observa el Abismo 🧭"));
app.listen(PORT, () => console.log(`🌐 Express levantado en puerto ${PORT}`));

//// BLOQUE 4: CLIENTE DE DISCORD ////
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

//// BLOQUE 5: ARCHIVOS Y FUNCIONES DE GUARDADO ////
const configPath = "./config.json";
const statusPath = "./status.json";
const objectsPath = "./objects.json";

const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, "utf8"))
  : { channels: { reliquies: [], trade: null, sell: null, tops: null } };

const objects = fs.existsSync(objectsPath)
  ? JSON.parse(fs.readFileSync(objectsPath, "utf8"))
  : { class4: [], class3: [], class2: [], special: [] };

const status = fs.existsSync(statusPath)
  ? JSON.parse(fs.readFileSync(statusPath, "utf8"))
  : {};

const saveStatus = () =>
  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));

const saveConfig = () =>
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

//// BLOQUE 6: RANGOS Y ROLES ////
const RANK_ROLES = [
  { name: "Bell", id: "1456176950849572979" },
  { name: "Silbato rojo", id: "1456178133240778763" },
  { name: "Silbato azul", id: "1456178299364573348" },
  { name: "Silbato lunar", id: "1456179008625447105" },
  { name: "Silbato negro", id: "1456178700096635002" },
  { name: "Silbato blanco", id: "1456179085364695133" }
];

const NAREHATE_ROLE_ID = "1456180289465483396";

//// BLOQUE 7: FUNCIONES DE STATUS ////
function getStatus(id, member = null) {
  if (!status[id]) {
    status[id] = {
      money: 0,
      rank: "Bell",
      humanity: true,
      inventory: {},
      messages: 0
    };
  }

  if (member) {
    const order = [
      "Bell",
      "Silbato rojo",
      "Silbato azul",
      "Silbato lunar",
      "Silbato negro",
      "Silbato blanco",
      "Narehate"
    ];
    const roles = member.roles.cache.map(r => r.name);
    const found = [...order].reverse().find(r => roles.includes(r));
    if (found) status[id].rank = found;
    status[id].humanity = !member.roles.cache.has(NAREHATE_ROLE_ID);
  }

  saveStatus();
  return status[id];
}

function getDiscordRank(member) {
  if (!member) return "Sin rango";
  if (member.roles.cache.has(NAREHATE_ROLE_ID)) return "Narehate";
  for (let i = RANK_ROLES.length - 1; i >= 0; i--) {
    if (member.roles.cache.has(RANK_ROLES[i].id))
      return RANK_ROLES[i].name;
  }
  return "Sin rango";
}

//// BLOQUE 8: DROP SYSTEM ////
client.on(Events.MessageCreate, message => {
  if (message.author.bot || !message.guild) return;
  if (!config.channels.reliquies.includes(message.channel.id)) return;

  const depth = config.channels.reliquies.indexOf(message.channel.id);
  const user = getStatus(message.author.id, message.member);
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
  if (!pool.length) return;

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
  saveStatus();

  message.reply(`🧭 Encontraste ${item.icon} ${item.name}`);
});

//// BLOQUE 9: COMANDOS ////
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
      o.setName("user")
        .setDescription("Usuario")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("setchannelreliquies")
    .setDescription("Configurar reliquias")
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
];

const rest = new REST({ version: "10" }).setToken(TOKEN);
const activeTrades = new Map();

//// BLOQUE 10: INTERACTIONS ////
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isButton()) return;

    const user = getStatus(interaction.user.id, interaction.member);

    //// CHAT COMMANDS ////
    if (interaction.isChatInputCommand()) {
      //// INVENTORY ////
      if (interaction.commandName === "inventory") {
        const items = Object.values(user.inventory);
        if (!items.length)
          return interaction.reply({ ephemeral: true, content: "🎒 Tu inventario está vacío." });
        return interaction.reply({
          ephemeral: true,
          content: items.map(i => `${i.icon} ${i.name} x${i.qty}`).join("\n")
        });
      }

      //// MY MONEY ////
      if (interaction.commandName === "mymoney") {
        return interaction.reply({ ephemeral: true, content: `💰 Tienes ${user.money} monedas.` });
      }

      //// SELL ////
      if (interaction.commandName === "sell") {
        const mode = interaction.options.getString("mode");
        const invItems = Object.values(user.inventory);
        if (!invItems.length)
          return interaction.reply({ ephemeral: true, content: "🎒 No tienes reliquias para vender." });

        if (mode === "one") {
          const item = invItems[0];
          user.money += (item.price ?? 0);
          item.qty--;
          if (item.qty <= 0) delete user.inventory[item.name];
          saveStatus();
          return interaction.reply({ content: `💰 Vendiste 1 ${item.icon} ${item.name} por ${item.price} monedas.` });
        }

        if (mode === "all") {
          let total = 0;
          invItems.forEach(item => {
            total += (item.price ?? 0) * item.qty;
            delete user.inventory[item.name];
          });
          user.money += total;
          saveStatus();
          return interaction.reply({ content: `💰 Vendiste todo tu inventario por ${total} monedas.` });
        }
      }

      //// TRADE INICIO ////
      if (interaction.commandName === "trade") {
        const targetUser = interaction.options.getUser("user");
        if (!targetUser) return interaction.reply({ ephemeral: true, content: "❌ Usuario inválido." });
        if (targetUser.id === interaction.user.id) return interaction.reply({ ephemeral: true, content: "❌ No puedes intercambiar contigo mismo." });

        const fromUser = getStatus(interaction.user.id, interaction.member);
        const toUser = getStatus(targetUser.id);

        if (Object.keys(fromUser.inventory).length === 0)
          return interaction.reply({ ephemeral: true, content: "🎒 No tienes objetos para ofrecer." });
        if (Object.keys(toUser.inventory).length === 0)
          return interaction.reply({ ephemeral: true, content: `${targetUser.tag} no tiene objetos para intercambiar.` });

        const selectMenu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`trade_select_${interaction.user.id}_${targetUser.id}`)
            .setPlaceholder("Selecciona un objeto para ofrecer")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(
              Object.values(fromUser.inventory).map(item => ({
                label: `${item.name} (x${item.qty})`,
                value: item.name,
                description: `Precio: ${item.price}`,
                emoji: item.icon
              }))
            )
        );

        return interaction.reply({
          ephemeral: true,
          content: `🔄 Selecciona un objeto para ofrecer a ${targetUser.tag}:`,
          components: [selectMenu]
        });
      }

      //// SET CHANNEL COMMANDS ////
      if(interaction.commandName === "setchannelreliquies"){
        config.channels.reliquies.push(interaction.channel.id);
        saveConfig();
        return interaction.reply({ content: "✅ Este canal ahora es de reliquias.", ephemeral: true });
      }
      if(interaction.commandName === "setchanneltrade"){
        config.channels.trade = interaction.channel.id;
        saveConfig();
        return interaction.reply({ content: "✅ Este canal ahora es de trade.", ephemeral: true });
      }
      if(interaction.commandName === "setchannelsell"){
        config.channels.sell = interaction.channel.id;
        saveConfig();
        return interaction.reply({ content: "✅ Este canal ahora es de venta.", ephemeral: true });
      }
      if(interaction.commandName === "setchanneltops"){
        config.channels.tops = interaction.channel.id;
        saveConfig();
        return interaction.reply({ content: "✅ Este canal ahora es de tops.", ephemeral: true });
      }
    }

    //// STRING SELECT MENUS Y BOTONES DE TRADE ////
    // (aquí iría todo el bloque de trade select y confirm como antes, idéntico al que ya te di)
    
  } catch (err) {
    console.error("Error en InteractionCreate:", err);
  }
});

//// BLOQUE 11: LOGIN ////
client.login(TOKEN).then(() => console.log("🤖 Bot iniciado correctamente"));

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
      const guildChannels = interaction.guild.channels.cache
        .filter(c => c.isTextBased())
        .map(c => ({ label: c.name, value: c.id }));

      // INVENTORY
      if (interaction.commandName === "inventory") {
        const items = Object.values(user.inventory);
        if (!items.length)
          return interaction.reply({ ephemeral: true, content: "🎒 Tu inventario está vacío." });
        return interaction.reply({ ephemeral: true, content: items.map(i => `${i.icon} ${i.name} x${i.qty}`).join("\n") });
      }

      // MY MONEY
      if (interaction.commandName === "mymoney") {
        return interaction.reply({ ephemeral: true, content: `💰 Tienes ${user.money} monedas.` });
      }

      // SELL
      if (interaction.commandName === "sell") {
        const mode = interaction.options.getString("mode");
        const invItems = Object.values(user.inventory);
        if (!invItems.length)
          return interaction.reply({ ephemeral: true, content: "🎒 No tienes reliquias para vender." });

        if (mode === "one") {
          const item = invItems[0];
          user.money += item.price ?? 0;
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

      // TRADE
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
            .addOptions(Object.values(fromUser.inventory).map(item => ({
              label: `${item.name} (x${item.qty})`,
              value: item.name,
              description: `Precio: ${item.price}`,
              emoji: item.icon
            })))
        );

        return interaction.reply({ ephemeral: true, content: `🔄 Selecciona un objeto para ofrecer a ${targetUser.tag}:`, components: [selectMenu] });
      }

      // SET CHANNEL MENUS
      if (interaction.commandName.startsWith("setchannel")) {
        let placeholder = "";
        let customId = "";
        if (interaction.commandName === "setchannelreliquies") { placeholder = "Selecciona hasta 6 canales de reliquias"; customId = "setchannel_reliquies"; }
        if (interaction.commandName === "setchanneltrade") { placeholder = "Selecciona el canal de trade"; customId = "setchannel_trade"; }
        if (interaction.commandName === "setchannelsell") { placeholder = "Selecciona el canal de venta"; customId = "setchannel_sell"; }
        if (interaction.commandName === "setchanneltops") { placeholder = "Selecciona el canal de tops"; customId = "setchannel_tops"; }

        const menu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(placeholder)
            .setMinValues(1)
            .setMaxValues(customId === "setchannel_reliquies" ? Math.min(6, guildChannels.length) : 1)
            .addOptions(guildChannels)
        );

        return interaction.reply({ ephemeral: true, content: `📌 ${placeholder}:`, components: [menu] });
      }
    }

    //// MENÚS SELECT
    if (interaction.isStringSelectMenu()) {
      const { customId, values } = interaction;

      // SET CHANNELS
      if (customId.startsWith("setchannel")) {
        const channelKey = customId.split("_")[1];
        if (channelKey === "reliquies") config.channels.reliquies = values;
        if (channelKey === "trade") config.channels.trade = values[0];
        if (channelKey === "sell") config.channels.sell = values[0];
        if (channelKey === "tops") config.channels.tops = values[0];
        saveConfig();
        return interaction.update({ content: `✅ Configuración actualizada: ${values.map(id => `<#${id}>`).join(", ")}`, components: [] });
      }

      // TRADE SELECT
      if (customId.startsWith("trade_select_") && !customId.endsWith("_response")) {
        const [_, fromId, toId] = customId.split("_");
        const trade = {
          from: fromId,
          to: toId,
          fromItem: values[0],
          fromQty: 1,
          toItem: null,
          toQty: 0,
          confirmed: { from: false, to: false },
          timeout: null
        };
        activeTrades.set(fromId, trade);

        const toMember = await interaction.guild.members.fetch(toId).catch(() => null);
        if (!toMember) return interaction.reply({ ephemeral: true, content: "❌ Usuario no encontrado." });
        const toStatus = getStatus(toId);

        const selectMenu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`trade_select_${fromId}_${toId}_response`)
            .setPlaceholder(`${toMember.user.tag}, selecciona el objeto que deseas ofrecer`)
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(Object.values(toStatus.inventory).map(item => ({
              label: `${item.name} (x${item.qty})`,
              value: item.name,
              description: `Precio: ${item.price}`,
              emoji: item.icon
            })))
        );

        return interaction.followUp({ ephemeral: true, content: `📩 ${toMember.user.tag}, selecciona un objeto para ofrecer...`, components: [selectMenu] });
      }

      if (customId.endsWith("_response")) {
        const [_, fromId, toId] = customId.split("_");
        const trade = activeTrades.get(fromId);
        if (!trade) return interaction.reply({ ephemeral: true, content: "❌ Trade no encontrado o expirado." });

        trade.toItem = values[0];
        trade.toQty = 1;
        activeTrades.set(fromId, trade);

        const fromMember = await interaction.guild.members.fetch(fromId).catch(() => null);
        const toMember = await interaction.guild.members.fetch(toId).catch(() => null);

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("Aceptar")
            .setStyle(ButtonStyle.Success)
            .setCustomId(`trade_confirm_${fromId}_${toId}_accept`),
          new ButtonBuilder()
            .setLabel("Rechazar")
            .setStyle(ButtonStyle.Danger)
            .setCustomId(`trade_confirm_${fromId}_${toId}_reject`)
        );

        await interaction.followUp({
          ephemeral: true,
          content: `🔄 Trade propuesto:\n${fromMember.user.tag} ofrece ${trade.fromItem} x${trade.fromQty}\n${toMember.user.tag} ofrece ${trade.toItem} x${trade.toQty}\nAmbos deben confirmar en 2 minutos.`,
          components: [confirmRow]
        });

        trade.timeout = setTimeout(() => {
          activeTrades.delete(fromId);
          interaction.followUp({ ephemeral: true, content: "⏰ El trade expiró." });
        }, 2 * 60 * 1000);
      }
    }

    //// BOTONES DE CONFIRMACIÓN
    if (interaction.isButton() && interaction.customId.startsWith("trade_confirm_")) {
      const [_, fromId, toId, action] = interaction.customId.split("_");
      const trade = activeTrades.get(fromId);
      if (!trade) return interaction.reply({ ephemeral: true, content: "❌ Trade no encontrado o expirado." });

      const userKey = interaction.user.id === fromId ? "from" : "to";

      if (action === "accept") {
        trade.confirmed[userKey] = true;
        if (trade.confirmed.from && trade.confirmed.to) {
          // Intercambiar
          const fromStatus = getStatus(fromId);
          const toStatus = getStatus(toId);

          const fromItem = fromStatus.inventory[trade.fromItem];
          const toItem = toStatus.inventory[trade.toItem];

          // Swap
          fromStatus.inventory[trade.toItem] = toItem;
          delete toStatus.inventory[trade.toItem];

          toStatus.inventory[trade.fromItem] = fromItem;
          delete fromStatus.inventory[trade.fromItem];

          saveStatus();
          activeTrades.delete(fromId);

          return interaction.update({ ephemeral: true, content: `✅ Trade completado entre ${interaction.guild.members.cache.get(fromId).user.tag} y ${interaction.guild.members.cache.get(toId).user.tag}.`, components: [] });
        } else {
          activeTrades.set(fromId, trade);
          return interaction.reply({ ephemeral: true, content: "✅ Confirmado, esperando al otro usuario..." });
        }
      }

      if (action === "reject") {
        activeTrades.delete(fromId);
        return interaction.update({ ephemeral: true, content: "❌ Trade rechazado.", components: [] });
      }
    }

  } catch (err) {
    console.error(err);
  }
});

//// LOGIN ////
client.login(TOKEN);

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

      //// ===== REEMPLAZO DE SET CHANNELS POR MENÚ EFÍMERO =====
      const guildChannels = interaction.guild.channels.cache
        .filter(c => c.isTextBased())
        .map(c => ({ label: c.name, value: c.id }));

      if (interaction.commandName === "setchannelreliquies") {
        const menu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("setchannel_reliquies")
            .setPlaceholder("Selecciona hasta 6 canales de reliquias")
            .setMinValues(1)
            .setMaxValues(Math.min(6, guildChannels.length))
            .addOptions(guildChannels)
        );
        return interaction.reply({ ephemeral: true, content: "📌 Selecciona los canales de reliquias:", components: [menu] });
      }

      if (interaction.commandName === "setchanneltrade") {
        const menu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("setchannel_trade")
            .setPlaceholder("Selecciona el canal de trade")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(guildChannels)
        );
        return interaction.reply({ ephemeral: true, content: "📌 Selecciona el canal de trade:", components: [menu] });
      }

      if (interaction.commandName === "setchannelsell") {
        const menu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("setchannel_sell")
            .setPlaceholder("Selecciona el canal de venta")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(guildChannels)
        );
        return interaction.reply({ ephemeral: true, content: "📌 Selecciona el canal de venta:", components: [menu] });
      }

      if (interaction.commandName === "setchanneltops") {
        const menu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("setchannel_tops")
            .setPlaceholder("Selecciona el canal de tops")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(guildChannels)
        );
        return interaction.reply({ ephemeral: true, content: "📌 Selecciona el canal de tops:", components: [menu] });
      }
    }

    //// ===== RESPUESTA MENÚ EFÍMERO PARA SET CHANNELS =====
    if (interaction.isStringSelectMenu()) {
      switch (interaction.customId) {
        case "setchannel_reliquies":
          config.channels.reliquies = interaction.values;
          saveConfig();
          return interaction.update({ content: `✅ Canales de reliquias guardados: ${interaction.values.map(id => `<#${id}>`).join(", ")}`, components: [] });

        case "setchannel_trade":
          config.channels.trade = interaction.values[0];
          saveConfig();
          return interaction.update({ content: `✅ Canal de trade guardado: <#${interaction.values[0]}>`, components: [] });

        case "setchannel_sell":
          config.channels.sell = interaction.values[0];
          saveConfig();
          return interaction.update({ content: `✅ Canal de venta guardado: <#${interaction.values[0]}>`, components: [] });

        case "setchannel_tops":
          config.channels.tops = interaction.values[0];
          saveConfig();
          return interaction.update({ content: `✅ Canal de tops guardado: <#${interaction.values[0]}>`, components: [] });
      }
    }

    ///// ===== BLOQUE DE TRADE SELECT Y CONFIRM =====
if (interaction.isStringSelectMenu() && interaction.customId.startsWith("trade_select_") && !interaction.customId.endsWith("_response")) {
  const [_, fromId, toId] = interaction.customId.split("_");
  const selectedItemName = interaction.values[0];

  const trade = {
    from: fromId,
    to: toId,
    fromItem: selectedItemName,
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
      .addOptions(
        Object.values(toStatus.inventory).map(item => ({
          label: `${item.name} (x${item.qty})`,
          value: item.name,
          description: `Precio: ${item.price}`,
          emoji: item.icon
        }))
      )
  );

  await interaction.followUp({
    ephemeral: true,
    content: `📩 ${toMember.user.tag}, selecciona un objeto para ofrecer...`,
    components: [selectMenu]
  });
}

if (interaction.isStringSelectMenu() && interaction.customId.endsWith("_response")) {
  const [_, fromId, toId] = interaction.customId.split("_");
  const trade = activeTrades.get(fromId);
  if (!trade) return interaction.reply({ ephemeral: true, content: "❌ Trade no encontrado o expirado." });

  trade.toItem = interaction.values[0];
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

  // Timeout de 2 minutos
  trade.timeout = setTimeout(() => {
    activeTrades.delete(fromId);
    interaction.followUp({ ephemeral: true, content: "⏰ El trade expiró." });
  }, 2 * 60 * 1000);
}

if (interaction.isButton() && interaction.customId.startsWith("trade_confirm_")) {
  const [_, fromId, toId, action] = interaction.customId.split("_");
  const trade = activeTrades.get(fromId);
  if (!trade) return interaction.reply({ ephemeral: true, content: "❌ Trade no encontrado o expirado." });

  if (action === "accept") {
    trade.confirmed[interaction.user.id === fromId ? "from" : "to"] = true;
    activeTrades.set(fromId, trade);

    if (trade.confirmed.from && trade.confirmed.to) {
      const fromStatus = getStatus(fromId);
      const toStatus = getStatus(toId);

      const fromItem = fromStatus.inventory[trade.fromItem];
      const toItem = toStatus.inventory[trade.toItem];

      // Restar cantidades
      fromItem.qty -= trade.fromQty;
      if (fromItem.qty <= 0) delete fromStatus.inventory[trade.fromItem];
      toItem.qty -= trade.toQty;
      if (toItem.qty <= 0) delete toStatus.inventory[trade.toItem];

      // Agregar al otro
      if (!toStatus.inventory[trade.fromItem]) toStatus.inventory[trade.fromItem] = { ...fromItem, qty: trade.fromQty };
      else toStatus.inventory[trade.fromItem].qty += trade.fromQty;

      if (!fromStatus.inventory[trade.toItem]) fromStatus.inventory[trade.toItem] = { ...toItem, qty: trade.toQty };
      else fromStatus.inventory[trade.toItem].qty += trade.toQty;

      saveStatus();
      clearTimeout(trade.timeout);
      activeTrades.delete(fromId);

      return interaction.update({
        content: `✅ Trade completado:\n${fromMember.user.tag} intercambió ${trade.fromItem} x${trade.fromQty}\n${toMember.user.tag} intercambió ${trade.toItem} x${trade.toQty}`,
        components: []
      });
    } else {
      return interaction.reply({ ephemeral: true, content: "✅ Has aceptado el trade, esperando al otro usuario..." });
    }
  }

  if (action === "reject") {
    clearTimeout(trade.timeout);
    activeTrades.delete(fromId);
    return interaction.update({ content: `❌ Trade cancelado por ${interaction.user.tag}`, components: [] });
  }
    }
  });

//// BLOQUE 11: LOGIN ////
client.login(TOKEN).then(() => console.log("🤖 Bot iniciado correctamente"));

import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  PermissionsBitField
} from "discord.js";

import fs from "fs";
import express from "express";

/* =====================
ENV
===================== */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

/* =====================
EXPRESS
===================== */
const app = express();
app.get("/", (_, res) => res.send("Belaf observa el Abismo 🧭"));
app.listen(PORT, () =>
  console.log(`🌐 Express levantado en puerto ${PORT}`)
);

/* =====================
CLIENT
===================== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

/* =====================
FILES
===================== */
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

/* =====================
RANGOS
===================== */
const RANK_ROLES = [
  { name: "Bell", id: "1456176950849572979" },
  { name: "Silbato rojo", id: "1456178133240778763" },
  { name: "Silbato azul", id: "1456178299364573348" },
  { name: "Silbato lunar", id: "1456179008625447105" },
  { name: "Silbato negro", id: "1456178700096635002" },
  { name: "Silbato blanco", id: "1456179085364695133" }
];

const NAREHATE_ROLE_ID = "1456180289465483396";

/* =====================
STATUS
===================== */
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

/* =====================
DROP SYSTEM
===================== */
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

/* =====================
COMMANDS
===================== */
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

/* =====================
INTERACTIONS (COMPLETO)
===================== */
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (!interaction.isChatInputCommand() && !interaction.isChannelSelectMenu()) return;

    const user = getStatus(interaction.user.id, interaction.member);

    /* ===== CHAT COMMANDS ===== */
    if (interaction.isChatInputCommand()) {

      /* ===== INVENTORY ===== */
      if (interaction.commandName === "inventory") {
        const items = Object.values(user.inventory);
        if (!items.length)
          return interaction.reply({ ephemeral: true, content: "🎒 Tu inventario está vacío." });

        return interaction.reply({
          ephemeral: true,
          content: items.map(i => `${i.icon} ${i.name} x${i.qty}`).join("\n")
        });
      }

      /* ===== MY MONEY ===== */
      if (interaction.commandName === "mymoney") {
        return interaction.reply({
          ephemeral: true,
          content: `💰 Tienes ${user.money} monedas.`
        });
      }

      /* ===== SELL ===== */
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

      /* =====================
TRADE MULTI-UNIDAD
===================== */
const activeTrades = new Map(); // Guarda trades activos por ID

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (!interaction.isChatInputCommand() && !interaction.isMessageComponent() && !interaction.isStringSelectMenu()) return;

    /* ===== INICIAR TRADE ===== */
    if (interaction.isChatInputCommand() && interaction.commandName === "trade") {
      const targetUser = interaction.options.getUser("user");
      if (!targetUser) return interaction.reply({ ephemeral: true, content: "❌ Usuario inválido." });
      if (targetUser.id === interaction.user.id) return interaction.reply({ ephemeral: true, content: "❌ No puedes intercambiar contigo mismo." });

      const fromUser = getStatus(interaction.user.id, interaction.member);
      const toUser = getStatus(targetUser.id);

      if (Object.keys(fromUser.inventory).length === 0)
        return interaction.reply({ ephemeral: true, content: "🎒 No tienes objetos para ofrecer." });
      if (Object.keys(toUser.inventory).length === 0)
        return interaction.reply({ ephemeral: true, content: `${targetUser.tag} no tiene objetos para intercambiar.` });

      // Crear menú de selección de objeto + cantidad
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

    /* ===== MENÚ DE SELECCIÓN DE OBJETOS ===== */
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("trade_select_")) {
      const [_, fromId, toId, step] = interaction.customId.split("_");
      const selectedItemName = interaction.values[0];

      const trade = {
        from: fromId,
        to: toId,
        fromItem: selectedItemName,
        fromQty: 1, // Inicial, luego seleccionable
        toItem: null,
        toQty: 0,
        confirmed: { from: false, to: false },
        timeout: null
      };
      activeTrades.set(fromId, trade);

      // Enviar mensaje al segundo usuario para seleccionar objeto y cantidad
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

    /* ===== RESPUESTA DEL SEGUNDO USUARIO ===== */
    if (interaction.isStringSelectMenu() && interaction.customId.endsWith("_response")) {
      const [_, fromId, toId] = interaction.customId.split("_");
      const trade = activeTrades.get(fromId);
      if (!trade) return interaction.reply({ ephemeral: true, content: "❌ Trade no encontrado o expirado." });

      trade.toItem = interaction.values[0];
      trade.toQty = 1; // Inicial
      activeTrades.set(fromId, trade);

      const fromMember = await interaction.guild.members.fetch(fromId).catch(() => null);
      const toMember = await interaction.guild.members.fetch(toId).catch(() => null);

      const confirmRow = new ActionRowBuilder().addComponents(
        {
          type: 2, label: "Aceptar", style: 3, custom_id: `trade_confirm_${fromId}_${toId}_accept`
        },
        {
          type: 2, label: "Rechazar", style: 4, custom_id: `trade_confirm_${fromId}_${toId}_reject`
        }
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

    /* ===== BOTONES DE CONFIRMACIÓN ===== */
    if (interaction.isButton() && interaction.customId.startsWith("trade_confirm_")) {
      const [_, fromId, toId, action] = interaction.customId.split("_");
      const trade = activeTrades.get(fromId);
      if (!trade) return interaction.reply({ ephemeral: true, content: "❌ Trade no encontrado o expirado." });

      if (action === "accept") {
        trade.confirmed[interaction.user.id === fromId ? "from" : "to"] = true;
        activeTrades.set(fromId, trade);

        // Si ambos confirmaron, realizar intercambio
        if (trade.confirmed.from && trade.confirmed.to) {
          const fromStatus = getStatus(fromId);
          const toStatus = getStatus(toId);

          // Restar cantidad
          const fromItem = fromStatus.inventory[trade.fromItem];
          const toItem = toStatus.inventory[trade.toItem];
          fromItem.qty -= trade.fromQty; if (fromItem.qty <= 0) delete fromStatus.inventory[trade.fromItem];
          toItem.qty -= trade.toQty; if (toItem.qty <= 0) delete toStatus.inventory[trade.toItem];

          // Agregar al otro
          if (!toStatus.inventory[trade.fromItem]) toStatus.inventory[trade.fromItem] = { ...fromItem, qty: 0 };
          if (!fromStatus.inventory[trade.toItem]) fromStatus.inventory[trade.toItem] = { ...toItem, qty: 0 };
          toStatus.inventory[trade.fromItem].qty += trade.fromQty;
          fromStatus.inventory[trade.toItem].qty += trade.toQty;

          saveStatus();
          clearTimeout(trade.timeout);
          activeTrades.delete(fromId);

          return interaction.update({ ephemeral: true, content: "✅ Trade completado correctamente.", components: [] });
        } else {
          return interaction.reply({ ephemeral: true, content: "✅ Confirmaste el trade, esperando al otro usuario." });
        }
      }

      if (action === "reject") {
        clearTimeout(trade.timeout);
        activeTrades.delete(fromId);
        return interaction.update({ ephemeral: true, content: "❌ Trade rechazado.", components: [] });
      }
    }

  } catch (err) {
    console.error("❌ Trade error:", err);
    if (!interaction.replied) interaction.reply({ ephemeral: true, content: "❌ Ocurrió un error en el trade." });
  }
});
      }

      /* ===== SET CHANNELS ===== */
      if (interaction.commandName.startsWith("setchannel")) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
          return interaction.reply({ ephemeral: true, content: "❌ No tienes permisos." });

        const row = new ActionRowBuilder().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId(`set_${interaction.commandName}`)
            .setPlaceholder("Selecciona canal")
            .setMinValues(1)
            .setMaxValues(interaction.commandName === "setchannelreliquies" ? 6 : 1)
            .addChannelTypes(ChannelType.GuildText)
        );

        return interaction.reply({
          ephemeral: true,
          content: "📌 Selecciona canal:",
          components: [row]
        });
      }
    }

    /* ===== CHANNEL SELECT ===== */
    if (interaction.isChannelSelectMenu()) {
      switch (interaction.customId) {
        case "set_setchanneltops":
          config.channels.tops = interaction.values[0];
          break;
        case "set_setchanneltrade":
          config.channels.trade = interaction.values[0];
          break;
        case "set_setchannelsell":
          config.channels.sell = interaction.values[0];
          break;
        case "set_setchannelreliquies":
          config.channels.reliquies = interaction.values;
          break;
      }

      saveConfig();
      return interaction.update({
        content: "✅ Canal configurado correctamente",
        components: []
      });
    }

  } catch (err) {
    console.error("❌ Interaction error:", err);
    if (!interaction.replied) {
      interaction.reply({ ephemeral: true, content: "❌ Ocurrió un error." });
    }
  }
});

/* =====================
TOP EXPLORADORES
===================== */
async function sendTopExploradores() {
  if (!config.channels.tops) return;

  const channel = await client.channels.fetch(config.channels.tops).catch(() => null);
  if (!channel || !channel.guild) return;

  const data = [];
  for (const [id, u] of Object.entries(status)) {
    let member = null;
    try {
      member = await channel.guild.members.fetch(id);
    } catch {}

    const totalItems = Object.values(u.inventory ?? {}).reduce((sum, i) => sum + (i.qty ?? 0), 0);

    data.push({
      id,
      tag: member ? member.user.tag : "Usuario salido",
      rank: getDiscordRank(member),
      money: u.money ?? 0,
      items: totalItems
    });
  }

  const top = data.sort((a, b) => b.money - a.money).slice(0, 10);
  if (!top.length) return;

  const text = top.map((u, i) =>
    `${i + 1}. ${u.tag}\n🧭 Rango: ${u.rank}\n💰 Dinero: ${u.money}\n🎒 Objetos: ${u.items}`
  ).join("\n\n");

  await channel.send({ content: `🏆 **TOP EXPLORADORES** 🏆\n\n${text}` });
}

/* Enviar top cada 10 minutos */
setInterval(sendTopExploradores, 10 * 60 * 1000);

/* =====================
SAFE SAVE
===================== */
process.on("SIGINT", () => { saveStatus(); process.exit(); });
process.on("SIGTERM", () => { saveStatus(); process.exit(); });
process.on("uncaughtException", err => { console.error(err); saveStatus(); process.exit(1); });

/* =====================
CLIENT READY
===================== */
client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log(`🧭 Belaf despierta como ${client.user.tag}`);
});

/* =====================
LOGIN
===================== */
client.login(TOKEN);

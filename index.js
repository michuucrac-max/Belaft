/* =====================
IMPORTS
===================== */
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
app.listen(PORT, () => console.log(`🌐 Express en puerto ${PORT}`));

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
const statusPath = "./status.json";
const configPath = "./config.json";
const objectsPath = "./objects.json";

const status = fs.existsSync(statusPath)
  ? JSON.parse(fs.readFileSync(statusPath, "utf8"))
  : {};

const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, "utf8"))
  : { channels: { reliquies: [], trade: null, sell: null, tops: null } };

const objects = fs.existsSync(objectsPath)
  ? JSON.parse(fs.readFileSync(objectsPath, "utf8"))
  : { class4: [], class3: [], class2: [], special: [] };

const saveStatusSafe = () => {
  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
};

/* =====================
RANGOS / ROLES
===================== */
const RANK_ROLES = [
  { name: "Bell", id: "1456176950849572979", cost: 0 },
  { name: "Silbato rojo", id: "1456178133240778763", cost: 100 },
  { name: "Silbato azul", id: "1456178299364573348", cost: 300 },
  { name: "Silbato lunar", id: "1456179008625447105", cost: 700 },
  { name: "Silbato negro", id: "1456178700096635002", cost: 1500 },
  { name: "Silbato blanco", id: "1456179085364695133", cost: 3000 }
];

const NAREHATE_ROLE_ID = "1456180289465483396";

/* =====================
STATUS MANAGEMENT
===================== */
function getStatus(id) {
  if (!status[id]) {
    status[id] = {
      money: 0,
      rank: "Bell",
      humanity: true,
      inventory: {},
      messages: 0
    };
    saveStatusSafe();
  }
  return status[id];
}

function syncMemberRank(member) {
  if (!member) return;
  const user = getStatus(member.id);

  if (member.roles.cache.has(NAREHATE_ROLE_ID)) {
    user.rank = "Narehate";
    user.humanity = false;
  } else {
    for (let i = RANK_ROLES.length - 1; i >= 0; i--) {
      if (member.roles.cache.has(RANK_ROLES[i].id)) {
        user.rank = RANK_ROLES[i].name;
        break;
      }
    }
    user.humanity = true;
  }
  saveStatusSafe();
}

/* =====================
RANKUP COMMAND
===================== */
async function handleRankup(interaction) {
  const member = interaction.member;
  const user = getStatus(member.id);

  if (!user.humanity)
    return interaction.reply({ ephemeral: true, content: "❌ Los narehates no ascienden." });

  const currentIndex = RANK_ROLES.findIndex(r => r.name === user.rank);
  if (currentIndex === -1 || currentIndex === RANK_ROLES.length - 1)
    return interaction.reply({ ephemeral: true, content: "🏅 Rango máximo alcanzado." });

  const next = RANK_ROLES[currentIndex + 1];
  if (user.money < next.cost)
    return interaction.reply({ ephemeral: true, content: `💰 Necesitas ${next.cost} monedas.` });

  // Quitar rol anterior
  const currentRole = RANK_ROLES[currentIndex];
  if (currentRole?.id && member.roles.cache.has(currentRole.id)) {
    await member.roles.remove(currentRole.id).catch(() => {});
  }

  // Dar rol nuevo
  await member.roles.add(next.id).catch(() => {});

  user.money -= next.cost;
  user.rank = next.name;
  saveStatusSafe();

  return interaction.reply(`🏅 Ascendiste a **${next.name}** (-${next.cost} 💰)`);
}

/* =====================
/* =====================
COMMANDS
===================== */
const commands = [
  new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),
  new SlashCommandBuilder().setName("rankup").setDescription("Ascender de rango"),
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
      o.setName("user").setDescription("Usuario").setRequired(true)),
  new SlashCommandBuilder().setName("setchannelreliquies").setDescription("Configurar drops").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder().setName("setchanneltrade").setDescription("Configurar trade").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder().setName("setchannelsell").setDescription("Configurar sell").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder().setName("setchanneltops").setDescription("Configurar tops").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

/* =====================
GUARDADO SEGURO
===================== */
function saveStatusSafe() {
  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
}

/* =====================
RANKUP CON ROLES
===================== */
async function handleRankup(interaction) {
  const member = interaction.member;
  const user = getStatus(interaction.user.id, member);

  if (!user.humanity)
    return interaction.reply({ ephemeral: true, content: "❌ Los narehates no pueden ascender." });

  const order = ["Bell","Silbato rojo","Silbato azul","Silbato lunar","Silbato negro","Silbato blanco"];
  const costs = [0,100,300,700,1500,3000];

  const index = order.indexOf(user.rank);
  if (index === -1 || index === order.length - 1)
    return interaction.reply({ ephemeral: true, content: "🏅 Ya estás en el rango máximo." });

  const cost = costs[index + 1];
  if (user.money < cost)
    return interaction.reply({ ephemeral: true, content: `💰 Necesitas ${cost} monedas.` });

  const nextRank = order[index + 1];
  const nextRole = RANK_ROLES.find(r => r.name === nextRank);
  if (!nextRole)
    return interaction.reply({ ephemeral: true, content: "❌ Rol no configurado." });

  user.money -= cost;
  user.rank = nextRank;

  for (const r of RANK_ROLES) {
    if (member.roles.cache.has(r.id))
      await member.roles.remove(r.id).catch(() => {});
  }

  await member.roles.add(nextRole.id).catch(() => {});
  saveStatusSafe();

  return interaction.reply(`🏅 Ascendiste a **${nextRank}** (-${cost} 💰)`);
}

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    const user = getStatus(interaction.user.id, interaction.member);

    if (interaction.commandName === "inventory") {
      if (!Object.keys(user.inventory).length)
        return interaction.reply({ ephemeral: true, content: "🎒 Tu inventario está vacío." });

      const list = Object.values(user.inventory)
        .map(i => `${i.icon} ${i.name} x${i.qty}`)
        .join("\n");

      return interaction.reply({ ephemeral: true, content: `🎒 **Inventario**\n${list}` });
    }

    if (interaction.commandName === "mymoney") {
      return interaction.reply({ ephemeral: true, content: `💰 Tienes **${user.money}** monedas.` });
    }

    if (interaction.commandName === "rankup") {
      return handleRankup(interaction);
    }

    if (interaction.commandName === "sell") {
      const mode = interaction.options.getString("mode");
      if (!Object.keys(user.inventory).length)
        return interaction.reply({ ephemeral: true, content: "🎒 No tienes objetos." });

      let sold = [];
      if (mode === "one") {
        const item = Object.values(user.inventory)[0];
        user.money += item.price;
        item.qty--;
        sold.push(`${item.icon} ${item.name}`);
        if (item.qty <= 0) delete user.inventory[item.name];
      } else {
        for (const i of Object.values(user.inventory)) {
          user.money += i.price * i.qty;
          sold.push(`${i.icon} ${i.name} x${i.qty}`);
        }
        user.inventory = {};
      }

      saveStatusSafe();
      return interaction.reply({ ephemeral: true, content: `💰 Vendiste: ${sold.join(", ")}` });
    }

    if (interaction.commandName.startsWith("setchannel")) {
      const id = interaction.commandName.replace("setchannel", "");
      const multi = id === "reliquies";

      const menu = new ChannelSelectMenuBuilder()
        .setCustomId(`setchannel_${id}`)
        .setPlaceholder("Selecciona canal(es)")
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(multi ? 6 : 1);

      return interaction.reply({
        ephemeral: true,
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    }
  }

  if (interaction.isChannelSelectMenu() && interaction.customId.startsWith("setchannel_")) {
    const id = interaction.customId.replace("setchannel_", "");

    if (id === "reliquies") config.channels.reliquies = interaction.values;
    if (id === "trade") config.channels.trade = interaction.values[0];
    if (id === "sell") config.channels.sell = interaction.values[0];
    if (id === "tops") config.channels.tops = interaction.values[0];

    saveConfig();
    return interaction.update({ content: "📜 Canal configurado.", components: [] });
  }
});

/* =====================
READY
===================== */
client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log(`🧭 Belaf despierta como ${client.user.tag}`);
});

/* =====================
SAFE SAVE
===================== */
process.on("SIGINT", () => { saveStatusSafe(); process.exit(); });
process.on("SIGTERM", () => { saveStatusSafe(); process.exit(); });
process.on("uncaughtException", err => {
  console.error(err);
  saveStatusSafe();
  process.exit(1);
});

/* =====================
LOGIN
===================== */
client.login(TOKEN);

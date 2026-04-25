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
PermissionsBitField,
EmbedBuilder
} from "discord.js";
import fs from "fs";
import express from "express";

/* ===================== ENV ===================== */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

/* ===================== EXPRESS ===================== */
const app = express();
app.get("/", (_, res) => res.send("Belaf observa el Abismo 🧭"));
app.listen(PORT, () => console.log(`🌐 Express activo en ${PORT}`));

/* ===================== FILES ===================== */
const configPath = "./config.json";
const statusPath = "./status.json";
const objectsPath = "./objects.json";

const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, "utf8"))
  : { channels: { reliquies: [], trade: null, sell: null, tops: null } };

const objects = fs.existsSync(objectsPath)
  ? JSON.parse(fs.readFileSync(objectsPath, "utf8"))
  : { class4: [], class3: [], class2: [], class1: [], special: [], ultra: [] };

const status = fs.existsSync(statusPath)
  ? JSON.parse(fs.readFileSync(statusPath, "utf8"))
  : {};

const saveStatus = () => fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
const saveConfig = () => fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
const saveObjects = () => fs.writeFileSync(objectsPath, JSON.stringify(objects, null, 2));

/* ===================== ROLES ===================== */
const ranks = {
bell: "1456176950849572979",
silbato_rojo: "1456178133240778763",
silbato_azul: "1456178299364573348",
silbato_lunar: "1456179008625447105",
silbato_negro: "1456178700096635002",
silbato_blanco: "1456179085364695133",
narehate: "1456180289465483396"
};

/* ===================== STATUS ===================== */
function getStatus(id) {
  if (!status[id]) status[id] = { money: 0, inventory: {}, messages: 0 };
  return status[id];
}

/* ===================== CLIENT ===================== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

/* ===================== SLASH COMMANDS ===================== */
const commands = [
  new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),

  new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Vender objetos")
    .addStringOption(o =>
      o.setName("modo")
        .setDescription("Modo")
        .setRequired(true)
        .addChoices(
          { name: "Uno", value: "one" },
          { name: "Todo", value: "all" }
        )
    ),

  new SlashCommandBuilder()
    .setName("rankup")
    .setDescription("Subir de rango"),

  new SlashCommandBuilder()
    .setName("setmoney")
    .setDescription("Dar dinero")
    .addUserOption(o => o.setName("usuario").setRequired(true))
    .addNumberOption(o => o.setName("cantidad").setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

/* ===================== REST ===================== */
const rest = new REST({ version: "10" }).setToken(TOKEN);

/* ===================== READY ===================== */
client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

  console.log(`🧭 Belaf despierta como ${client.user.tag}`);

  /* TOPS */
  setInterval(async () => {
    if (!config.channels.tops) return;

    const guild = client.guilds.cache.first();
    if (!guild) return;

    const members = await guild.members.fetch();

    const topUsers = [];
    members.forEach(m => {
      if (m.user.bot) return;
      const st = getStatus(m.id);
      topUsers.push({ tag: m.user.tag, money: st.money });
    });

    topUsers.sort((a, b) => b.money - a.money);
    const top10 = topUsers.slice(0, 10);

    const embed = new EmbedBuilder()
      .setTitle("🏆 TOP Exploradores")
      .setDescription(
        top10.map((u, i) => `**${i + 1}.** ${u.tag} — 💰 ${u.money}`).join("\n")
      );

    const ch = guild.channels.cache.get(config.channels.tops);
    if (ch) ch.send({ embeds: [embed] });

  }, 600000);
});
/* ===================== INTERACTIONS ===================== */
client.on(Events.InteractionCreate, async interaction => {

  if (!interaction.isChatInputCommand() &&
      !interaction.isStringSelectMenu() &&
      !interaction.isChannelSelectMenu()) return;

  const user = getStatus(interaction.user.id);

  /* ================= INVENTORY ================= */
  if (interaction.commandName === "inventory") {
    if (!Object.keys(user.inventory).length)
      return interaction.reply({ ephemeral: true, content: "🎒 Vacío." });

    const list = Object.values(user.inventory)
      .map(i => `${i.icon} ${i.name} x${i.qty}`)
      .join("\n");

    return interaction.reply({
      ephemeral: true,
      content: `🎒 Inventario\n${list}`
    });
  }

  /* ================= MONEY ================= */
  if (interaction.commandName === "mymoney") {
    return interaction.reply({
      ephemeral: true,
      content: `💰 ${user.money} monedas`
    });
  }

  /* ================= SELL ================= */
  if (interaction.commandName === "sell") {
    const mode = interaction.options.getString("modo");

    if (!Object.keys(user.inventory).length)
      return interaction.reply({ ephemeral: true, content: "❌ No tienes objetos." });

    if (mode === "all") {
      let gain = 0;

      for (const i of Object.values(user.inventory)) {
        const price = Number(i.price ?? i.value ?? 0);
        gain += price * i.qty;
      }

      user.money += gain;
      user.inventory = {};
      saveStatus();

      return interaction.reply({
        ephemeral: true,
        content: `💰 Vendido todo por ${gain} monedas`
      });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`sell_one`)
      .setPlaceholder("Selecciona objeto")
      .addOptions(
        Object.values(user.inventory).map(i => ({
          label: i.name,
          description: `x${i.qty} | 💰 ${i.price ?? i.value ?? 0}`,
          value: i.name
        }))
      );

    return interaction.reply({
      ephemeral: true,
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  /* ================= SELL SELECT ================= */
  if (interaction.isStringSelectMenu() && interaction.customId === "sell_one") {

    const itemName = interaction.values[0];
    const item = user.inventory[itemName];

    if (!item) return interaction.update({ content: "❌ Error item", components: [] });

    const price = Number(item.price ?? item.value ?? 0);

    item.qty -= 1;
    user.money += price;

    if (item.qty <= 0) delete user.inventory[itemName];

    saveStatus();

    return interaction.update({
      content: `💰 Vendido ${itemName} por ${price}`,
      components: []
    });
  }

  /* ================= RANKUP FIXED ================= */
  if (interaction.commandName === "rankup") {

    const member = interaction.member;

    const order = [
      "silbato_rojo",
      "silbato_azul",
      "silbato_lunar",
      "silbato_negro",
      "silbato_blanco",
      "narehate"
    ];

    const costs = [100, 300, 600, 1200, 2500, 5000];

    let index = -1;

    for (let i = 0; i < order.length; i++) {
      const role = interaction.guild.roles.cache.get(ranks[order[i]]);
      if (role && member.roles.cache.has(role.id)) index = i;
    }

    if (index === order.length - 1)
      return interaction.reply({ ephemeral: true, content: "🏆 Ya estás al máximo rango" });

    const nextRole = order[index + 1];
    const cost = costs[index + 1];

    if (user.money < cost)
      return interaction.reply({ ephemeral: true, content: `❌ Necesitas ${cost} monedas` });

    user.money -= cost;

    const role = interaction.guild.roles.cache.get(ranks[nextRole]);

    await member.roles.add(role);

    saveStatus();

    return interaction.reply({
      ephemeral: true,
      content: `🎖️ Subiste a ${nextRole}`
    });
  }

});

/* ===================== DROP SYSTEM (PROBABILIDAD REAL + DM) ===================== */
client.on(Events.MessageCreate, async message => {

  if (message.author.bot || !message.guild) return;

  if (!config.channels.reliquies.includes(message.channel.id)) return;

  const user = getStatus(message.author.id);

  /* 🔥 PROBABILIDAD REAL (NO POR CONTADOR) */
  const chance = Math.random();

  // 8% drop base
  if (chance > 0.08) return;

  const pool = [
    ...objects.class4,
    ...objects.class3,
    ...objects.class2,
    ...objects.special
  ];

  if (!pool.length) return;

  const item = pool[Math.floor(Math.random() * pool.length)];

  if (!user.inventory[item.name]) {
    user.inventory[item.name] = { ...item, qty: 0 };
  }

  user.inventory[item.name].qty += 1;

  saveStatus();

  /* ===================== DM SYSTEM ===================== */
  try {
    await message.author.send(
      `🧭 Has encontrado un artefacto:\n**${item.icon} ${item.name} x1**`
    );
  } catch {
    // fallback anti error silencioso
    message.channel.send(
      `🧭 ${message.author}, encontraste **${item.icon} ${item.name} x1**`
    );
  }
});

/* ===================== LOGIN ===================== */
client.login(TOKEN);

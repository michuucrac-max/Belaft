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
ANTI CRASH
===================== */
process.on("unhandledRejection", console.log);
process.on("uncaughtException", console.log);

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
app.listen(PORT, () => console.log(`🌐 Express activo en ${PORT}`));

/* =====================
FILES
===================== */
const configPath = "./config.json";
const statusPath = "./status.json";
const objectsPath = "./objects.json";

const config = fs.existsSync(configPath)
? JSON.parse(fs.readFileSync(configPath, "utf8"))
: { channel: null };

const objects = fs.existsSync(objectsPath)
? JSON.parse(fs.readFileSync(objectsPath, "utf8"))
: { class4: [], class3: [], class2: [], class1: [], special: [], ultra: [] };

const status = fs.existsSync(statusPath)
? JSON.parse(fs.readFileSync(statusPath, "utf8"))
: {};

const saveStatus = () => fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
const saveConfig = () => fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

function getStatus(id) {
if (!status[id]) status[id] = { money: 0, inventory: {} };
return status[id];
}

/* =====================
RANGOS FLEXIBLES
===================== */
const rankOrder = [
"bell",
"silbato rojo",
"silbato azul",
"silbato lunar",
"silbato negro",
"silbato blanco"
];

const rankCosts = [0, 25000, 50000, 75000, 150000, 1200000];

function getMemberRank(member) {
const roles = member.roles.cache.map(r => r.name.toLowerCase());
for (let i = rankOrder.length - 1; i >= 0; i--) {
if (roles.includes(rankOrder[i])) return i;
}
return -1;
}

/* =====================
PROBABILIDAD DROP
===================== */
function rollItem() {
const all = [
...objects.class4.map(i => ({ ...i, chance: 70 })),
...objects.class3.map(i => ({ ...i, chance: 20 })),
...objects.class2.map(i => ({ ...i, chance: 8 })),
...objects.class1.map(i => ({ ...i, chance: 4 })),
...objects.special.map(i => ({ ...i, chance: 2 })),
...objects.ultra.map(i => ({ ...i, chance: 0.5 }))
];

if (!all.length) return null;

const total = all.reduce((a,b)=>a+b.chance,0);
let rand = Math.random() * total;

for (const item of all) {
rand -= item.chance;
if (rand <= 0) return item;
}
return null;
}

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
COMMANDS
===================== */
const commands = [
new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),

new SlashCommandBuilder()
.setName("sell")
.setDescription("Vender reliquias")
.addStringOption(o =>
o.setName("modo").setRequired(true)
.addChoices(
{ name:"Uno", value:"one" },
{ name:"Todo", value:"all" }
)
),

new SlashCommandBuilder()
.setName("setchannelreliquies")
.setDescription("Configurar canal de drops")
.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

new SlashCommandBuilder()
.setName("rankup")
.setDescription("Subir rango")
];

/* =====================
REGISTER
===================== */
const rest = new REST({ version:"10" }).setToken(TOKEN);

client.once(Events.ClientReady, async ()=>{
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
console.log(`🧭 Belaf listo como ${client.user.tag}`);
});

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {
  try {

    /* ========= SET CHANNEL RELIQUIES ========= */
    if (interaction.isChatInputCommand() && interaction.commandName === "setchannelreliquies") {

      const menu = new ChannelSelectMenuBuilder()
        .setCustomId("set_reliquies")
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1);

      return interaction.reply({
        ephemeral: true,
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    }

    /* ========= SET CHANNEL TOPS ========= */
    if (interaction.isChatInputCommand() && interaction.commandName === "setchanneltops") {

      const menu = new ChannelSelectMenuBuilder()
        .setCustomId("set_tops")
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1);

      return interaction.reply({
        ephemeral: true,
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    }

    /* ========= SELECT MENUS ========= */
    if (interaction.isChannelSelectMenu()) {

      if (interaction.customId === "set_reliquies") {
        config.channel = interaction.values[0];
        saveConfig();

        return interaction.update({
          content: "✅ Canal de reliquias configurado",
          components: []
        });
      }

      if (interaction.customId === "set_tops") {
        config.channels = config.channels || {};
        config.channels.tops = interaction.values[0];
        saveConfig();

        return interaction.update({
          content: "🏆 Canal de tops configurado",
          components: []
        });
      }
    }

    /* ========= STRING MENUS ========= */
    if (interaction.isStringSelectMenu()) {

      /* SELL */
      if (interaction.customId.startsWith("sell_")) {

        const mode = interaction.customId.replace("sell_", "");
        const user = getStatus(interaction.user.id);
        const itemName = interaction.values[0];
        const item = user.inventory[itemName];

        if (!item)
          return interaction.update({ content: "❌ Objeto inválido", components: [] });

        let gain = 0;
        const price = Number(item.price ?? item.value ?? 0);

        if (mode === "one") {
          item.qty--;
          gain = price;
        } else {
          gain = item.qty * price;
          delete user.inventory[itemName];
        }

        if (item.qty <= 0) delete user.inventory[itemName];

        user.money += gain;
        saveStatus();

        return interaction.update({
          content: `💰 Vendido ${itemName} por ${gain} monedas`,
          components: []
        });
      }

      /* SETITEM */
      if (interaction.customId.startsWith("setitem_")) {

        const targetId = interaction.customId.replace("setitem_", "");
        const target = interaction.guild.members.cache.get(targetId)?.user;

        if (!target)
          return interaction.update({ content: "❌ Usuario no encontrado", components: [] });

        const user = getStatus(target.id);
        const itemName = interaction.values[0];

        const all = [
          ...objects.class4,
          ...objects.class3,
          ...objects.class2,
          ...objects.class1,
          ...objects.special,
          ...objects.ultra
        ];

        const obj = all.find(o => o.name === itemName);
        if (!obj)
          return interaction.update({ content: "❌ Artefacto no encontrado", components: [] });

        if (!user.inventory[itemName]) user.inventory[itemName] = { ...obj, qty: 0 };
        user.inventory[itemName].qty++;

        saveStatus();

        return interaction.update({
          content: `✅ Artefacto ${itemName} agregado a ${target.tag}`,
          components: []
        });
      }

      /* REMOVEITEM */
      if (interaction.customId.startsWith("removeitem_")) {

        const targetId = interaction.customId.replace("removeitem_", "");
        const target = interaction.guild.members.cache.get(targetId)?.user;

        if (!target)
          return interaction.update({ content: "❌ Usuario no encontrado", components: [] });

        const user = getStatus(target.id);
        const itemName = interaction.values[0];
        const item = user.inventory[itemName];

        if (!item)
          return interaction.update({ content: "❌ No tiene ese objeto", components: [] });

        item.qty--;
        if (item.qty <= 0) delete user.inventory[itemName];

        saveStatus();

        return interaction.update({
          content: `🗑️ Eliminado ${itemName} a ${target.tag}`,
          components: []
        });
      }

      return;
    }

    /* ========= COMANDOS ========= */
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply({ ephemeral: true });

    const cmd = interaction.commandName;

    /* INVENTORY */
    if (cmd === "inventory") {
      const user = getStatus(interaction.user.id);

      if (!Object.keys(user.inventory).length)
        return interaction.editReply("🎒 Vacío");

      const list = Object.values(user.inventory)
        .map(i => `${i.icon} ${i.name} x${i.qty}`)
        .join("\n");

      return interaction.editReply(`🎒 Inventario\n${list}`);
    }

    /* MONEY */
    if (cmd === "mymoney") {
      const user = getStatus(interaction.user.id);
      return interaction.editReply(`💰 ${user.money}`);
    }

    /* SELL */
    if (cmd === "sell") {
      const user = getStatus(interaction.user.id);
      const mode = interaction.options.getString("modo");

      if (!Object.keys(user.inventory).length)
        return interaction.editReply("❌ No tienes objetos");

      if (mode === "all") {
        let gain = 0;
        for (const i of Object.values(user.inventory)) {
          gain += (i.price ?? 0) * i.qty;
        }
        user.money += gain;
        user.inventory = {};
        saveStatus();

        return interaction.editReply(`💰 Vendido todo por ${gain}`);
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`sell_${mode}`)
        .addOptions(Object.values(user.inventory).map(i => ({
          label: i.name,
          value: i.name,
          description: `x${i.qty}`
        })));

      return interaction.editReply({
        content: "Selecciona objeto",
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    }

    /* ADMIN MONEY */
    if (["setmoney", "removemoney", "seemoney"].includes(cmd)) {

      const target = interaction.options.getUser("usuario");
      const amount = interaction.options.getNumber("cantidad") || 0;
      const user = getStatus(target.id);

      if (cmd === "setmoney") {
        user.money += amount;
        saveStatus();
        return interaction.editReply(`💰 Se dieron ${amount} a ${target.tag}`);
      }

      if (cmd === "removemoney") {
        user.money -= amount;
        if (user.money < 0) user.money = 0;
        saveStatus();
        return interaction.editReply(`💰 Se quitaron ${amount} a ${target.tag}`);
      }

      if (cmd === "seemoney") {
        return interaction.editReply(`💰 ${target.tag} tiene ${user.money}`);
      }
    }

    /* RANKUP */
    if (cmd === "rankup") {

      const member = interaction.member;
      const st = getStatus(member.id);

      let current = getMemberRank(member);

      if (current === rankOrder.length - 1)
        return interaction.editReply("🏆 Máximo rango");

      const next = current + 1;

      if (st.money < rankCosts[next])
        return interaction.editReply(`❌ Necesitas ${rankCosts[next]}`);

      st.money -= rankCosts[next];

      const role = member.guild.roles.cache.find(r =>
        r.name.toLowerCase() === rankOrder[next]
      );

      if (role) await member.roles.add(role).catch(() => {});

      saveStatus();

      return interaction.editReply(`🎖️ Subiste a ${rankOrder[next]}`);
    }

    /* SETITEM */
    if (cmd === "setitem") {

      const target = interaction.options.getUser("usuario");

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`setitem_${target.id}`)
        .addOptions([
          ...objects.class4,
          ...objects.class3,
          ...objects.class2,
          ...objects.class1,
          ...objects.special,
          ...objects.ultra
        ].map(o => ({
          label: o.name,
          value: o.name,
          description: `💰 ${o.price ?? 0}`
        })));

      return interaction.editReply({
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    }

    /* REMOVEITEM */
    if (cmd === "removeitem") {

      const target = interaction.options.getUser("usuario");
      const user = getStatus(target.id);

      if (!Object.keys(user.inventory).length)
        return interaction.editReply("❌ Sin objetos");

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`removeitem_${target.id}`)
        .addOptions(Object.values(user.inventory).map(i => ({
          label: i.name,
          value: i.name,
          description: `x${i.qty}`
        })));

      return interaction.editReply({
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    }

    return interaction.editReply("⚠️ Comando no reconocido");

  } catch (e) {
    console.log(e);

    if (interaction.deferred)
      return interaction.editReply("❌ Error");

    return interaction.reply({ content: "❌ Error", ephemeral: true });
  }
});


/* =====================
DROP SYSTEM (PROBABILIDAD + DM)
===================== */
client.on(Events.MessageCreate, async message => {

  if (message.author.bot || !message.guild) return;
  if (!config.channel) return;
  if (message.channel.id !== config.channel) return;

  if (Math.random() > 0.10) return;

  const user = getStatus(message.author.id);
  const item = rollItem();

  if (!item) return;

  if (!user.inventory[item.name])
    user.inventory[item.name] = { ...item, qty: 0 };

  user.inventory[item.name].qty++;
  saveStatus();

  try {
    await message.author.send(`🧭 Encontraste:\n${item.icon} ${item.name} x1`);
  } catch {
    message.reply("📩 Activa tus DMs");
  }
});


/* =====================
TOPS AUTOMÁTICOS
===================== */
setInterval(async () => {

  if (!config.channels?.tops) return;

  const guild = client.guilds.cache.first();
  if (!guild) return;

  const members = await guild.members.fetch();

  const ranking = [];

  members.forEach(m => {
    if (m.user.bot) return;
    const st = getStatus(m.id);
    ranking.push({ tag: m.user.tag, money: st.money });
  });

  ranking.sort((a,b)=>b.money-a.money);

  const top = ranking.slice(0,10)
    .map((u,i)=>`${i+1}. ${u.tag} — 💰 ${u.money}`)
    .join("\n");

  const ch = guild.channels.cache.get(config.channels.tops);
  if (!ch) return;

  ch.send(`🏆 TOP EXPLORADORES\n${top}`);

}, 10 * 60 * 1000);


/* =====================
LOGIN
===================== */
client.login(TOKEN);

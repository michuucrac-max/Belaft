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

const rankCosts = [100, 250, 500, 750, 1500, 3000];

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
    /* ========= SET CHANNEL (UN SOLO CANAL DE DROPS) ========= */
    if (interaction.isChatInputCommand() && interaction.commandName === "setchannelreliquies") {
      const menu = new ChannelSelectMenuBuilder()
        .setCustomId("set_reliquies")
        .setPlaceholder("Selecciona el canal de drops")
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1);

      return interaction.reply({
        ephemeral: true,
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    }

    if (interaction.isChannelSelectMenu() && interaction.customId === "set_reliquies") {
      // Guardamos UN solo canal (string)
      config.channel = interaction.values[0];
      saveConfig();

      return interaction.update({
        content: "✅ Canal de reliquias configurado",
        components: []
      });
    }

    /* ========= MENÚS (SELL / SETITEM / REMOVEITEM) ========= */
    if (interaction.isStringSelectMenu()) {

      /* --- SELL MENU --- */
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
          content: `💰 Vendido ${itemName} por ${gain} monedas.`,
          components: []
        });
      }

      /* --- SETITEM MENU --- */
      if (interaction.customId.startsWith("setitem_")) {
        const targetId = interaction.customId.replace("setitem_", "");
        const target = interaction.guild.members.cache.get(targetId)?.user;

        if (!target)
          return interaction.update({ content: "❌ Usuario no encontrado", components: [] });

        const user = getStatus(target.id);
        const itemName = interaction.values[0];

        const allObjs = [
          ...objects.class4,
          ...objects.class3,
          ...objects.class2,
          ...objects.class1,
          ...objects.special,
          ...objects.ultra
        ];

        const obj = allObjs.find(o => o.name === itemName);
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

      /* --- REMOVEITEM MENU --- */
      if (interaction.customId.startsWith("removeitem_")) {
        const targetId = interaction.customId.replace("removeitem_", "");
        const target = interaction.guild.members.cache.get(targetId)?.user;

        if (!target)
          return interaction.update({ content: "❌ Usuario no encontrado", components: [] });

        const user = getStatus(target.id);
        const itemName = interaction.values[0];
        const item = user.inventory[itemName];

        if (!item)
          return interaction.update({ content: "❌ Ese usuario no tiene ese artefacto", components: [] });

        item.qty--;
        if (item.qty <= 0) delete user.inventory[itemName];

        saveStatus();

        return interaction.update({
          content: `🗑️ Se removió ${itemName} a ${target.tag}`,
          components: []
        });
      }

      return;
    }

    /* ========= COMANDOS ========= */
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply({ ephemeral: true });

    const cmd = interaction.commandName;

    /* --- INVENTORY --- */
    if (cmd === "inventory") {
      const user = getStatus(interaction.user.id);

      if (!Object.keys(user.inventory).length)
        return interaction.editReply("🎒 Vacío.");

      const list = Object.values(user.inventory)
        .map(i => `${i.icon} ${i.name} x${i.qty}`)
        .join("\n");

      return interaction.editReply(`🎒 Inventario\n${list}`);
    }

    /* --- MYMONEY --- */
    if (cmd === "mymoney") {
      const user = getStatus(interaction.user.id);
      return interaction.editReply(`💰 ${user.money} monedas`);
    }

    /* --- SELL --- */
    if (cmd === "sell") {
      const user = getStatus(interaction.user.id);
      const mode = interaction.options.getString("modo");

      if (!Object.keys(user.inventory).length)
        return interaction.editReply("❌ No tienes objetos.");

      if (mode === "all") {
        let gain = 0;
        for (const i of Object.values(user.inventory)) {
          const price = Number(i.price ?? i.value ?? 0);
          gain += price * i.qty;
        }
        user.money += gain;
        user.inventory = {};
        saveStatus();

        return interaction.editReply(`💰 Vendido todo el inventario por ${gain} monedas`);
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`sell_${mode}`)
        .setPlaceholder("Selecciona objeto")
        .addOptions(
          Object.values(user.inventory).map(i => ({
            label: i.name,
            value: i.name,
            description: `x${i.qty} | 💰 ${i.price ?? i.value ?? 0}`
          }))
        );

      return interaction.editReply({
        content: "Selecciona objeto",
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    }

    /* --- ADMIN MONEY (set / remove / see) --- */
    if (["setmoney", "removemoney", "seemoney"].includes(cmd)) {
      const target = interaction.options.getUser("usuario");
      const amount = interaction.options.getNumber("cantidad") || 0;
      const user = getStatus(target.id);

      if (cmd === "setmoney") {
        user.money += amount;
        saveStatus();
        return interaction.editReply(`💰 Se dieron ${amount} monedas a ${target.tag}`);
      }

      if (cmd === "removemoney") {
        user.money -= amount;
        if (user.money < 0) user.money = 0;
        saveStatus();
        return interaction.editReply(`💰 Se quitaron ${amount} monedas a ${target.tag}`);
      }

      if (cmd === "seemoney") {
        return interaction.editReply(`💰 ${target.tag} tiene ${user.money} monedas`);
      }
    }

    /* --- GIFT (regalar artefacto) --- */
    if (cmd === "gift") {
      const target = interaction.options.getUser("usuario");
      const user = getStatus(interaction.user.id);

      if (!Object.keys(user.inventory).length)
        return interaction.editReply("❌ No tienes objetos para regalar.");

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`gift_${target.id}`)
        .setPlaceholder("Selecciona objeto a regalar")
        .addOptions(
          Object.values(user.inventory).map(i => ({
            label: i.name,
            value: i.name,
            description: `x${i.qty}`
          }))
        );

      return interaction.editReply({
        content: `Selecciona objeto para regalar a ${target.tag}`,
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("gift_")) {
      const targetId = interaction.customId.replace("gift_", "");
      const target = interaction.guild.members.cache.get(targetId)?.user;

      if (!target)
        return interaction.update({ content: "❌ Usuario no encontrado", components: [] });

      const sender = getStatus(interaction.user.id);
      const receiver = getStatus(target.id);

      const itemName = interaction.values[0];
      const item = sender.inventory[itemName];

      if (!item)
        return interaction.update({ content: "❌ No tienes ese objeto", components: [] });

      item.qty--;
      if (item.qty <= 0) delete sender.inventory[itemName];

      if (!receiver.inventory[itemName]) receiver.inventory[itemName] = { ...item, qty: 0 };
      receiver.inventory[itemName].qty++;

      saveStatus();

      return interaction.update({
        content: `🎁 Regalaste ${itemName} a ${target.tag}`,
        components: []
      });
    }

    /* --- RANKUP (FLEXIBLE) --- */
    if (cmd === "rankup") {
      const member = interaction.member;
      const st = getStatus(member.id);

      let current = getMemberRank(member);

      if (current === rankOrder.length - 1)
        return interaction.editReply("🏆 Ya alcanzaste el máximo rango");

      const next = current + 1;
      const cost = rankCosts[next];

      if (st.money < cost)
        return interaction.editReply(`❌ Necesitas ${cost} monedas`);

      st.money -= cost;

      const role = member.guild.roles.cache.find(
        r => r.name.toLowerCase() === rankOrder[next]
      );

      if (role) await member.roles.add(role).catch(() => {});

      saveStatus();

      return interaction.editReply(`🎖️ Subiste a ${rankOrder[next]} pagando ${cost}`);
    }

    /* --- SETITEM --- */
    if (cmd === "setitem") {
      const target = interaction.options.getUser("usuario");

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`setitem_${target.id}`)
        .setPlaceholder("Selecciona artefacto")
        .addOptions(
          [
            ...objects.class4,
            ...objects.class3,
            ...objects.class2,
            ...objects.class1,
            ...objects.special,
            ...objects.ultra
          ].map(o => ({
            label: o.name,
            value: o.name,
            description: `💰 ${o.price ?? o.value ?? 0}`
          }))
        );

      return interaction.editReply({
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    }

    /* --- REMOVEITEM --- */
    if (cmd === "removeitem") {
      const target = interaction.options.getUser("usuario");
      const user = getStatus(target.id);

      if (!Object.keys(user.inventory).length)
        return interaction.editReply("❌ Ese usuario no tiene objetos");

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`removeitem_${target.id}`)
        .setPlaceholder("Selecciona artefacto")
        .addOptions(
          Object.values(user.inventory).map(i => ({
            label: i.name,
            value: i.name,
            description: `x${i.qty}`
          }))
        );

      return interaction.editReply({
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    }

    /* --- CREATEARTEFACT --- */
    if (cmd === "createartefact") {
      const categoria = interaction.options.getString("categoria");
      const nombre = interaction.options.getString("nombre");
      const icono = interaction.options.getString("icono");
      const precio = interaction.options.getNumber("precio");

      if (!objects[categoria])
        return interaction.editReply("❌ Categoría inválida");

      objects[categoria].push({ name: nombre, icon: icono, price: precio });
      saveObjects();

      return interaction.editReply(`✨ Artefacto ${nombre} creado en ${categoria}`);
    }

    /* --- DEFAULT --- */
    return interaction.editReply(`⚠️ Comando no reconocido: ${cmd}`);

  } catch (e) {
    console.log("❌", e);

    if (interaction.deferred)
      return interaction.editReply("❌ Error interno");

    return interaction.reply({ content: "❌ Error", ephemeral: true });
  }
});


/* =====================
DROP SYSTEM (PROBABILIDAD + DM)
===================== */
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;

  // Un solo canal configurado
  if (!config.channel || message.channel.id !== config.channel) return;

  // Probabilidad global de drop (10%)
  if (Math.random() > 0.10) return;

  const user = getStatus(message.author.id);

  const item = rollItem();
  if (!item) return;

  if (!user.inventory[item.name])
    user.inventory[item.name] = { ...item, qty: 0 };

  user.inventory[item.name].qty++;
  saveStatus();

  // Enviar por DM
  try {
    await message.author.send(
      `🧭 ¡Has encontrado una reliquia!\n${item.icon} ${item.name} x1`
    );
  } catch {
    // fallback si DMs cerrados
    message.reply("📩 Activa tus DMs para recibir reliquias.");
  }
});


/* =====================
LOGIN
===================== */
client.login(TOKEN);

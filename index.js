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
FILES / CONFIG
===================== */
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

/* =====================
ROLES / RANKS
===================== */
const ranks = {
  bell: "1456176950849572979",
  silbato_rojo: "1456178133240778763",
  silbato_azul: "1456178299364573348",
  silbato_lunar: "1456179008625447105",
  silbato_negro: "1456178700096635002",
  silbato_blanco: "1456179085364695133",
  narehate: "1456180289465483396"
};

/* =====================
STATUS FUNCTION
===================== */
function getStatus(id) {
  if (!status[id]) status[id] = { money: 0, inventory: {}, messages: 0 };
  saveStatus();
  return status[id];
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
SLASH COMMANDS
===================== */
const commands = [
  new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),
  new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Vender reliquias")
    .addStringOption(o =>
      o.setName("modo").setDescription("Modo de venta").setRequired(true)
        .addChoices({ name: "Uno", value: "one" }, { name: "Todo", value: "all" })
    ),
  new SlashCommandBuilder()
    .setName("setchannelreliquies")
    .setDescription("Configurar drops")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName("setchanneltops")
    .setDescription("Configurar tops")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName("setmoney")
    .setDescription("Dar dinero a un usuario (Admin)")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true))
    .addNumberOption(o => o.setName("cantidad").setDescription("Cantidad a dar").setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName("removemoney")
    .setDescription("Quitar dinero a un usuario (Admin)")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true))
    .addNumberOption(o => o.setName("cantidad").setDescription("Cantidad a quitar").setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName("seemoney")
    .setDescription("Ver dinero de un usuario (Admin)")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName("gift")
    .setDescription("Regalar un artefacto a alguien")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true)),
  new SlashCommandBuilder()
    .setName("rankup")
    .setDescription("Subir de rango pagando con monedas obtenidas"),
  new SlashCommandBuilder()
    .setName("setitem")
    .setDescription("Dar un artefacto a un usuario (Admin)")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName("removeitem")
    .setDescription("Remover un artefacto de un usuario (Admin)")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName("createartefact")
    .setDescription("Crear un nuevo artefacto en objects.json (Admin)")
    .addStringOption(o => o.setName("categoria").setDescription("Categoría").setRequired(true))
    .addStringOption(o => o.setName("nombre").setDescription("Nombre del artefacto").setRequired(true))
    .addStringOption(o => o.setName("icono").setDescription("Emoji/Icono del artefacto").setRequired(true))
    .addNumberOption(o => o.setName("precio").setDescription("Precio del artefacto").setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

/* =====================
REST REGISTER
===================== */
const rest = new REST({ version: "10" }).setToken(TOKEN);

/* =====================
READY
===================== */
client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log(`🧭 Belaf despierta como ${client.user.tag}`);

  // =====================
  // AUTO TOPS CADA 10 MINUTOS
  // =====================
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
      .setDescription(top10.map((u, i) => `**${i + 1}.** ${u.tag} — 💰 ${u.money}`).join("\n"))
      .setFooter({ text: "Gaburon supervisa los tops" });

    const ch = guild.channels.cache.get(config.channels.tops);
    if (ch) await ch.send({ embeds: [embed], content: "@everyone @here" });

  }, 60 * 60 * 1000); // cada 10 minutos
});

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isChannelSelectMenu()) return;

  // --- SET CHANNELS ---
  if (interaction.isChatInputCommand() && interaction.commandName.startsWith("setchannel")) {
    const id = interaction.commandName.replace("setchannel", "");
    const menu = new ChannelSelectMenuBuilder()
      .setCustomId(`set_${id}`)
      .setPlaceholder("Selecciona canal")
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(id === "reliquies" ? 6 : 1);
    return interaction.reply({ ephemeral: true, components: [new ActionRowBuilder().addComponents(menu)] });
  }

  if (interaction.isChannelSelectMenu() && interaction.customId.startsWith("set_")) {
    const id = interaction.customId.replace("set_", "");
    if (id === "reliquies") config.channels.reliquies = interaction.values;
    if (id === "tops") config.channels.tops = interaction.values[0];
    saveConfig();
    return interaction.update({ content: "📜 Canal configurado.", components: [] });
  }

  // --- INVENTORY ---
  if (interaction.isChatInputCommand() && interaction.commandName === "inventory") {
    const user = getStatus(interaction.user.id);
    if (!Object.keys(user.inventory).length)
      return interaction.reply({ ephemeral: true, content: "🎒 Vacío." });
    const list = Object.values(user.inventory).map(i => `${i.icon} ${i.name} x${i.qty}`).join("\n");
    return interaction.reply({ ephemeral: true, content: `🎒 **Inventario**\n${list}` });
  }

  // --- MONEY ---
  if (interaction.isChatInputCommand() && interaction.commandName === "mymoney") {
    const user = getStatus(interaction.user.id);
    return interaction.reply({ ephemeral: true, content: `💰 ${user.money} monedas` });
  }

  // --- SELL ---
  if (interaction.isChatInputCommand() && interaction.commandName === "sell") {
    const user = getStatus(interaction.user.id);
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
      return interaction.reply({ ephemeral: true, content: `💰 Vendido todo el inventario por ${gain} monedas` });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`sell_${mode}`)
      .setPlaceholder("Selecciona objeto")
      .addOptions(Object.values(user.inventory).map(i => ({ label: i.name, description: `x${i.qty} | 💰 ${i.price ?? i.value ?? 0}`, value: i.name })));

    return interaction.reply({ ephemeral: true, components: [new ActionRowBuilder().addComponents(menu)] });
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("sell_")) {
    const mode = interaction.customId.replace("sell_", "");
    const itemName = interaction.values[0];
    const user = getStatus(interaction.user.id);
    const item = user.inventory[itemName];
    let gain = 0;
    if (mode === "one") { 
      const price = Number(item.price ?? item.value ?? 0);
      item.qty--;
      gain = price; 
    } else { // mode all
      const price = Number(item.price ?? item.value ?? 0);
      gain = item.qty * price;
      delete user.inventory[itemName];
    }
    if (item.qty <= 0) delete user.inventory[itemName];
    user.money += gain;
    saveStatus();
    return interaction.update({ content: `💰 Vendido **${itemName}** por ${gain} monedas.`, components: [] });
  }

  // --- ADMIN MONEY ---
  if (interaction.isChatInputCommand() && ["setmoney","removemoney","seemoney"].includes(interaction.commandName)) {
    const target = interaction.options.getUser("usuario");
    const amount = interaction.options.getNumber("cantidad") || 0;
    const user = getStatus(target.id);

    if (interaction.commandName === "setmoney") { user.money += amount; saveStatus(); return interaction.reply({ ephemeral: true, content: `💰 Se dieron ${amount} monedas a ${target}` }); }
    if (interaction.commandName === "removemoney") { user.money -= amount; if(user.money<0) user.money=0; saveStatus(); return interaction.reply({ ephemeral: true, content: `💰 Se quitaron ${amount} monedas a ${target}` }); }
    if (interaction.commandName === "seemoney") { return interaction.reply({ ephemeral: true, content: `💰 ${target.tag} tiene ${user.money} monedas` }); }
  }

  // --- RANKUP ---
  if(interaction.isChatInputCommand() && interaction.commandName==="rankup"){
    const member = interaction.member;
    const st = getStatus(member.id);

    const roleOrder = ["bell","silbato_rojo","silbato_azul","silbato_lunar","silbato_negro","silbato_blanco"];
    const rankCosts = [100, 250, 500, 750, 1500, 3000];

    let currentRoleIndex = -1;
    for(let i = roleOrder.length - 1; i >= 0; i--){
      if(member.roles.cache.has(ranks[roleOrder[i]])){
        currentRoleIndex = i;
        break;
      }
    }

    if(currentRoleIndex === roleOrder.length - 1)
      return interaction.reply({ephemeral:true, content:"✅ Ya alcanzaste el máximo rango"});

    const nextRole = roleOrder[currentRoleIndex + 1];
    const cost = rankCosts[currentRoleIndex + 1];

    if(st.money < cost)
      return interaction.reply({ephemeral:true, content:`❌ Necesitas ${cost} monedas para subir al siguiente rango`});

    st.money -= cost;
    await member.roles.add(ranks[nextRole]);

    // remover roles inferiores
    for(let i = 0; i <= currentRoleIndex; i++){
      if(member.roles.cache.has(ranks[roleOrder[i]])){
        await member.roles.remove(ranks[roleOrder[i]]);
      }
    }

    saveStatus();
    return interaction.reply({ephemeral:true, content:`✅ Subiste a **${nextRole}** pagando ${cost} monedas`});
  }

  /* ===== SETITEM ===== */
  if(interaction.isChatInputCommand() && interaction.commandName==="setitem"){
    const target = interaction.options.getUser("usuario");
    if(!target) return interaction.reply({ ephemeral:true, content:"❌ Usuario no encontrado" });

    const menu=new StringSelectMenuBuilder()
      .setCustomId(`setitem_${target.id}`)
      .setPlaceholder("Selecciona artefacto")
      .addOptions([...objects.class4,...objects.class3,...objects.class2,...objects.class1,...objects.special,...objects.ultra].map(o=>({
        label:o.name,
        value:o.name,
        description:`💰 ${o.value ?? o.price ?? 0}`
      })));

    return interaction.reply({ ephemeral:true, components:[new ActionRowBuilder().addComponents(menu)] });
  }

  if(interaction.isStringSelectMenu() && interaction.customId.startsWith("setitem_")){
    const targetId=interaction.customId.replace("setitem_","");
    const target=interaction.guild.members.cache.get(targetId)?.user;
    if(!target) return interaction.update({ content:"❌ Usuario no encontrado", components:[] });

    const user=getStatus(target.id);
    const itemName=interaction.values[0];
    const obj=[...objects.class4,...objects.class3,...objects.class2,...objects.class1,...objects.special,...objects.ultra].find(o=>o.name===itemName);
    if(!obj) return interaction.update({ content:"❌ Artefacto no encontrado", components:[] });

    if(!user.inventory[itemName]) user.inventory[itemName]={...obj,qty:0};
    user.inventory[itemName].qty++;
    saveStatus();
    return interaction.update({ content:`✅ Artefacto **${itemName}** agregado a ${target}`, components:[] });
  }

  /* ===== CREATEARTEFACT ===== */
  if(interaction.isChatInputCommand() && interaction.commandName==="createartefact"){
    const categoria = interaction.options.getString("categoria");
    const nombre = interaction.options.getString("nombre");
    const icono = interaction.options.getString("icono");
    const precio = interaction.options.getNumber("precio");

    if(!objects[categoria]) return interaction.reply({ ephemeral:true, content:"❌ Categoría inválida" });

    objects[categoria].push({ name:nombre, icon:icono, price:precio });
    saveObjects();
    return interaction.reply({ ephemeral:true, content:`✨ Artefacto **${nombre}** creado en categoría **${categoria}** con precio ${precio}` });
  }

});

/* =====================
DROP SYSTEM
===================== */
client.on(Events.MessageCreate, message => {
  if (message.author.bot || !message.guild) return;
  if (!config.channels.reliquies.includes(message.channel.id)) return;

  // Determinar el "depth" o nivel del canal para escoger el pool correcto
  const depth = config.channels.reliquies.indexOf(message.channel.id);
  const user = getStatus(message.author.id);

  // Contador de mensajes
  user.messages++;
  saveStatus();

  // Cada 10 mensajes puede salir un objeto
  if (user.messages % 10 !== 0) return;

  // Pools de objetos según rareza / canal
  const pools = [
    objects.class4, // canal principal
    objects.class3,
    objects.class2,
    objects.special,
    objects.special,
    objects.special
  ];
  const pool = pools[depth] ?? objects.class4;
  if (!pool.length) return;

  // Elegir objeto aleatorio
  const item = pool[Math.floor(Math.random() * pool.length)];

  // Agregar objeto al inventario del usuario
  if (!user.inventory[item.name]) user.inventory[item.name] = { ...item, qty: 0 };
  user.inventory[item.name].qty++;

  saveStatus();

  // Mensaje al usuario con el drop encontrado
  message.reply({
    content: `🧭 ¡Has encontrado un objeto!\n**${item.icon} ${item.name}** x1`
  });
});

/* =====================
LOGIN
===================== */
client.login(TOKEN);

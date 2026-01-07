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
  // antiguos
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
  // nuevos dinero
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
  // gift / rankup / items
  new SlashCommandBuilder()
    .setName("gift")
    .setDescription("Regalar un artefacto a alguien")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true))
    .addStringOption(o => o.setName("artefacto").setDescription("Artefacto a regalar").setRequired(true)),
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
});

/* =====================
INTERACTIONS
===================== */
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isChannelSelectMenu()) return;

  /* ===== SETCHANNELS ===== */
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

  /* ===== INVENTORY ===== */
  if (interaction.isChatInputCommand() && interaction.commandName === "inventory") {
    const user = getStatus(interaction.user.id);
    if (!Object.keys(user.inventory).length)
      return interaction.reply({ ephemeral: true, content: "🎒 Vacío." });
    const list = Object.values(user.inventory).map(i => `${i.icon} ${i.name} x${i.qty}`).join("\n");
    return interaction.reply({ ephemeral: true, content: `🎒 **Inventario**\n${list}` });
  }

  /* ===== MONEY ===== */
  if (interaction.isChatInputCommand() && interaction.commandName === "mymoney") {
    const user = getStatus(interaction.user.id);
    return interaction.reply({ ephemeral: true, content: `💰 ${user.money} monedas` });
  }

  /* ===== SELL ===== */
  if (interaction.isChatInputCommand() && interaction.commandName === "sell") {
    const user = getStatus(interaction.user.id);
    const mode = interaction.options.getString("modo");
    if (!Object.keys(user.inventory).length)
      return interaction.reply({ ephemeral: true, content: "❌ No tienes objetos." });

    if(mode==="all") {
      let gain=0;
      for(const i of Object.values(user.inventory)) gain+=i.price*i.qty;
      user.money+=gain;
      user.inventory={};
      saveStatus();
      return interaction.reply({ ephemeral:true, content:`💰 Vendido todo el inventario por ${gain} monedas` });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`sell_${mode}`)
      .setPlaceholder("Selecciona objeto")
      .addOptions(Object.values(user.inventory).map(i => ({ label: i.name, description: `x${i.qty} | 💰 ${i.price}`, value: i.name })));

    return interaction.reply({ ephemeral: true, components: [new ActionRowBuilder().addComponents(menu)] });
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("sell_")) {
    const mode = interaction.customId.replace("sell_", "");
    const itemName = interaction.values[0];
    const user = getStatus(interaction.user.id);
    const item = user.inventory[itemName];
    let gain = 0;
    if (mode === "one") { item.qty--; gain = item.price; }
    else { gain = item.qty * item.price; delete user.inventory[itemName]; }
    if (item.qty <= 0) delete user.inventory[itemName];
    user.money += gain;
    saveStatus();
    return interaction.update({ content: `💰 Vendido **${itemName}** por ${gain} monedas.`, components: [] });
  }

  /* ===== ADMIN MONEY COMMANDS ===== */
  if (interaction.isChatInputCommand() && ["setmoney","removemoney","seemoney"].includes(interaction.commandName)) {
    const target = interaction.options.getUser("usuario");
    const amount = interaction.options.getNumber("cantidad") || 0;
    const user = getStatus(target.id);

    if (interaction.commandName === "setmoney") { user.money += amount; saveStatus(); return interaction.reply({ ephemeral: true, content: `💰 Se dieron ${amount} monedas a ${target}` }); }
    if (interaction.commandName === "removemoney") { user.money -= amount; if(user.money<0) user.money=0; saveStatus(); return interaction.reply({ ephemeral: true, content: `💰 Se quitaron ${amount} monedas a ${target}` }); }
    if (interaction.commandName === "seemoney") { return interaction.reply({ ephemeral: true, content: `💰 ${target.tag} tiene ${user.money} monedas` }); }
  }

  /* ===== GIFT ===== */
  if (interaction.isChatInputCommand() && interaction.commandName === "gift") {
    const target = interaction.options.getUser("usuario");
    const user = getStatus(interaction.user.id);
    const tgt = getStatus(target.id);

    const items = Object.values(user.inventory).filter(i=>i.qty>0);
    if(!items.length) return interaction.reply({ ephemeral:true, content:"❌ No tienes artefactos disponibles" });

    const menu=new StringSelectMenuBuilder()
      .setCustomId(`gift_${target.id}`)
      .setPlaceholder("Selecciona artefacto")
      .addOptions(items.map(i=>({label:i.name,value:i.name,description:`x${i.qty}` })));

    return interaction.reply({ ephemeral:true, components:[new ActionRowBuilder().addComponents(menu)] });
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("gift_")) {
    const targetId=interaction.customId.replace("gift_","");
    const target=interaction.guild.members.cache.get(targetId)?.user;
    if(!target) return interaction.update({ content:"❌ Usuario no encontrado", components:[] });

    const user=getStatus(interaction.user.id);
    const tgt=getStatus(target.id);
    const itemName=interaction.values[0];

    if(!user.inventory[itemName]||user.inventory[itemName].qty<=0)
      return interaction.update({ content:"❌ Artefacto no disponible", components:[] });

    user.inventory[itemName].qty--;
    if(user.inventory[itemName].qty<=0) delete user.inventory[itemName];
    if(!tgt.inventory[itemName]) tgt.inventory[itemName]={name:itemName, icon: objects.class4.concat(objects.class3,objects.class2,objects.class1,objects.special,objects.ultra).find(o=>o.name===itemName)?.icon||"❓", price:0, qty:0};
    tgt.inventory[itemName].qty++;
    saveStatus();
    return interaction.update({ content:`🎁 Artefacto **${itemName}** regalado a ${target}`, components:[] });
  }

  /* ===== RANKUP ===== */
  if(interaction.isChatInputCommand() && interaction.commandName==="rankup"){
    const user = interaction.member;
    const st = getStatus(user.id);
    const roleOrder = ["bell","silbato_rojo","silbato_azul","silbato_lunar","silbato_negro","silbato_blanco"];
    let currentRoleIndex = roleOrder.findIndex(r=>user.roles.cache.has(ranks[r]));
    if(currentRoleIndex===-1) return interaction.reply({ephemeral:true,content:"❌ No tienes rango que subir"});
    if(currentRoleIndex===roleOrder.length-1) return interaction.reply({ephemeral:true,content:"✅ Ya alcanzaste el máximo rango"});

    const nextRole = roleOrder[currentRoleIndex+1];
    const cost = 100*(currentRoleIndex+1);
    if(st.money<cost) return interaction.reply({ephemeral:true,content:`❌ Necesitas ${cost} monedas para subir al siguiente rango`});

    st.money-=cost;
    await user.roles.add(ranks[nextRole]);
    if(currentRoleIndex>=0) await user.roles.remove(ranks[roleOrder[currentRoleIndex]]);
    saveStatus();
    return interaction.reply({ephemeral:true,content:`✅ Subiste a **${nextRole}** pagando ${cost} monedas`});
  }

  /* ===== SETITEM ===== */
  if(interaction.isChatInputCommand() && interaction.commandName==="setitem"){
    const target = interaction.options.getUser("usuario");
    if(!target) return interaction.reply({ ephemeral:true, content:"❌ Usuario no encontrado" });

    const menu=new StringSelectMenuBuilder()
      .setCustomId(`setitem_${target.id}`)
      .setPlaceholder("Selecciona artefacto")
      .addOptions([...objects.class4,...objects.class3,...objects.class2,...objects.class1,...objects.special,...objects.ultra].map(o=>({label:o.name,value:o.name,description:`💰 ${o.value || o.price || 0}`})));

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

  /* ===== REMOVEITEM ===== */
  if(interaction.isChatInputCommand() && interaction.commandName==="removeitem"){
    const target = interaction.options.getUser("usuario");
    if(!target) return interaction.reply({ ephemeral:true, content:"❌ Usuario no encontrado" });

    const user=getStatus(target.id);
    const items=Object.values(user.inventory).filter(i=>i.qty>0);
    if(!items.length) return interaction.reply({ ephemeral:true, content:"❌ No tiene artefactos" });

    const menu=new StringSelectMenuBuilder()
      .setCustomId(`removeitem_${target.id}`)
      .setPlaceholder("Selecciona artefacto")
      .addOptions(items.map(i=>({label:i.name,value:i.name,description:`x${i.qty}`})));

    return interaction.reply({ ephemeral:true, components:[new ActionRowBuilder().addComponents(menu)] });
  }

  if(interaction.isStringSelectMenu() && interaction.customId.startsWith("removeitem_")){
    const targetId = interaction.customId.replace("removeitem_","");
    const target = interaction.guild.members.cache.get(targetId)?.user;
    if(!target) return interaction.update({ content:"❌ Usuario no encontrado", components:[] });

    const user = getStatus(target.id);
    const itemName = interaction.values[0];
    if(!user.inventory[itemName]) return interaction.update({ content:"❌ Artefacto no encontrado", components:[] });

    user.inventory[itemName].qty--;
    if(user.inventory[itemName].qty <= 0) delete user.inventory[itemName];
    saveStatus();
    return interaction.update({ content:`🗑️ Artefacto **${itemName}** removido de ${target}`, components:[] });
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
DROP SYSTEM (cada 10 mensajes + evento aleatorio)
===================== */
client.on(Events.MessageCreate, message=>{
  if(message.author.bot || !message.guild) return;
  if(!config.channels.reliquies.includes(message.channel.id)) return;

  const depth=config.channels.reliquies.indexOf(message.channel.id);
  const user=getStatus(message.author.id);
  user.messages++;
  saveStatus();

  if(user.messages % 10 !== 0) return; // drop cada 10 mensajes

  const pools=[objects.class4, objects.class3, objects.class2, objects.special, objects.special, objects.special];
  const pool=pools[depth] ?? objects.class4;
  if(!pool.length) return;

  const item=pool[Math.floor(Math.random()*pool.length)];
  if(!user.inventory[item.name]) user.inventory[item.name]={...item, qty:0};
  user.inventory[item.name].qty++;
  saveStatus();
  message.reply(`🧭 Encontraste **${item.icon} ${item.name}**`);

  // === EVENTO ALEATORIO C4D4V3R ===
  const chance=Math.random();
  if(chance<0.02){ // 2%
    const gold=Math.floor(Math.random()*50+10); 
    const menu=new StringSelectMenuBuilder()
      .setCustomId(`cadaver_choice_${message.author.id}`)
      .setPlaceholder("Elegir acción")
      .addOptions([{ label:`Quedarte con ${gold} monedas`,value:"take" },{ label:"Dejarlo",value:"leave" }]);

    message.reply({ content:`💀 Has encontrado el c4d4v3r de un explorador con ${gold} monedas. ¿Qué deseas hacer?`, components:[new ActionRowBuilder().addComponents(menu)] });
  }
});

client.on(Events.StringSelectMenu, interaction=>{
  if(!interaction.customId.startsWith("cadaver_choice_")) return;
  const user=getStatus(interaction.user.id);
  const gold=Math.floor(Math.random()*50+10);

  if(interaction.values[0]==="take"){
    user.money+=gold;
    // 1% chance de narehate
    if(Math.random()<0.01){
      const member=interaction.member;
      if(!member.roles.cache.has(ranks.narehate)){
        member.roles.add(ranks.narehate);
        interaction.update({ content:`💀 Te quedaste con las monedas (${gold}) y te transformaste en **narehate**!`, components:[] });
        saveStatus();
        return;
      }
    }
    interaction.update({ content:`💀 Te quedaste con las monedas (${gold})`, components:[] });
    saveStatus();
  } else {
    interaction.update({ content:"💀 Decidiste dejar las monedas.", components:[] });
  }
});

/* =====================
TOPS SYSTEM
===================== */
async function sendTops(){
  if(!config.channels.tops) return;
  const ch=await client.channels.fetch(config.channels.tops).catch(()=>null);
  if(!ch) return;

  const users=Object.entries(status);
  const topMoney=[...users].sort((a,b)=>b[1].money-a[1].money).slice(0,5)
    .map((u,i)=>`${i+1}. <@${u[0]}> — 💰 ${u[1].money}`).join("\n");
  const topMsg=[...users].sort((a,b)=>b[1].messages-a[1].messages).slice(0,5)
    .map((u,i)=>`${i+1}. <@${u[0]}> — 💬 ${u[1].messages}`).join("\n");

  await ch.send(`🏆 **TOPS DEL ABISMO**\n\n💰 **Riqueza**\n${topMoney || "Sin datos"}\n\n💬 **Actividad**\n${topMsg || "Sin datos"}`);
}
setInterval(sendTops, 10*60*1000);

/* =====================
LOGIN
===================== */
client.login(TOKEN);

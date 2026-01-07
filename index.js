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
  : { class4: [], class3: [], class2: [], special: [] };

const status = fs.existsSync(statusPath)
  ? JSON.parse(fs.readFileSync(statusPath, "utf8"))
  : {};

const saveStatus = () => fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
const saveConfig = () => fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

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
  // nuevos admin
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
    .setName("setitem")
    .setDescription("Dar un artefacto a un usuario (Admin)")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true))
    .addStringOption(o => o.setName("artefacto").setDescription("Seleccionar artefacto").setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName("removeitem")
    .setDescription("Quitar un artefacto del inventario (Admin)")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true))
    .addStringOption(o => o.setName("artefacto").setDescription("Seleccionar artefacto").setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  // gift / rankup
  new SlashCommandBuilder()
    .setName("gift")
    .setDescription("Regalar un artefacto a alguien")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true)),
  new SlashCommandBuilder()
    .setName("rankup")
    .setDescription("Subir de rango pagando con monedas obtenidas")
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

  /* ===== ADMIN COMMANDS ===== */
  if (interaction.isChatInputCommand() && ["setmoney","removemoney","seemoney","setitem","removeitem"].includes(interaction.commandName)) {
    const target = interaction.options.getUser("usuario");
    const artifactName = interaction.options.getString("artefacto");
    const amount = interaction.options.getNumber("cantidad") || 0;
    const user = getStatus(target.id);

    if(interaction.commandName==="setmoney"){ user.money+=amount; saveStatus(); return interaction.reply({ephemeral:true,content:`💰 Se dieron ${amount} monedas a ${target}`}); }
    if(interaction.commandName==="removemoney"){ user.money-=amount; if(user.money<0) user.money=0; saveStatus(); return interaction.reply({ephemeral:true,content:`💰 Se quitaron ${amount} monedas a ${target}`}); }
    if(interaction.commandName==="seemoney"){ return interaction.reply({ephemeral:true,content:`💰 ${target.tag} tiene ${user.money} monedas`}); }
    if(interaction.commandName==="setitem"){
      if(!user.inventory[artifactName]) user.inventory[artifactName]={name:artifactName,icon:"❓",price:10,qty:0};
      user.inventory[artifactName].qty++;
      saveStatus();
      return interaction.reply({ephemeral:true,content:`🎁 Artefacto **${artifactName}** dado a ${target}`});
    }
    if(interaction.commandName==="removeitem"){
      if(user.inventory[artifactName] && user.inventory[artifactName].qty>0){ user.inventory[artifactName].qty--; if(user.inventory[artifactName].qty<=0) delete user.inventory[artifactName]; saveStatus(); return interaction.reply({ephemeral:true,content:`🗑️ Artefacto **${artifactName}** removido de ${target}`}); }
      else return interaction.reply({ephemeral:true,content:`❌ ${target} no tiene ese artefacto`});
    }
  }

  /* ===== GIFT con select menu de artefactos ===== */
  if (interaction.isChatInputCommand() && interaction.commandName==="gift"){
    const user = getStatus(interaction.user.id);
    const target = interaction.options.getUser("usuario");
    const userArtifacts = Object.values(user.inventory).filter(i=>i.qty>0);
    if(!userArtifacts.length) return interaction.reply({ephemeral:true,content:"❌ No tienes artefactos para regalar."});

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`gift_select_${target.id}`)
      .setPlaceholder("Selecciona artefacto a regalar")
      .addOptions(userArtifacts.map(i=>({label:i.name,value:i.name,description:`x${i.qty}` })));

    return interaction.reply({ephemeral:true,components:[new ActionRowBuilder().addComponents(menu)]});
  }

  if(interaction.isStringSelectMenu() && interaction.customId.startsWith("gift_select_")){
    const targetId = interaction.customId.replace("gift_select_","");
    const user = getStatus(interaction.user.id);
    const target = getStatus(targetId);
    const artifactName = interaction.values[0];
    if(!user.inventory[artifactName] || user.inventory[artifactName].qty<=0) return interaction.update({ephemeral:true,content:"❌ Artefacto no disponible.",components:[]});

    user.inventory[artifactName].qty--;
    if(user.inventory[artifactName].qty<=0) delete user.inventory[artifactName];
    if(!target.inventory[artifactName]) target.inventory[artifactName]={name:artifactName,icon:"❓",price:10,qty:0};
    target.inventory[artifactName].qty++;
    saveStatus();
    interaction.update({ephemeral:true,content:`🎁 Artefacto **${artifactName}** regalado a <@${targetId}>`,components:[]});
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
});

/* =====================
DROP SYSTEM + EVENTOS ALEATORIOS
===================== */
client.on(Events.MessageCreate,message=>{
  if(message.author.bot||!message.guild) return;
  if(!config.channels.reliquies.includes(message.channel.id)) return;
  const depth=config.channels.reliquies.indexOf(message.channel.id);
  const user=getStatus(message.author.id);
  user.messages++;
  saveStatus();
  if(user.messages%10!==0) return;

  const pools=[objects.class4,objects.class3,objects.class2,objects.special,objects.special,objects.special];
  const pool=pools[depth]??objects.class4;
  if(!pool.length) return;
  const item=pool[Math.floor(Math.random()*pool.length)];
  if(!user.inventory[item.name]) user.inventory[item.name]={name:item.name,icon:item.icon,price:item.price??10,qty:0};
  user.inventory[item.name].qty++;
  saveStatus();
  message.reply(`🧭 Encontraste **${item.icon} ${item.name}**`);

  // EVENTO ALEATORIO: C4D4V3R
  if(Math.random()<0.02){
    const gold=Math.floor(Math.random()*50+10);
    const menu=new StringSelectMenuBuilder()
      .setCustomId(`cadaver_choice_${message.author.id}`)
      .setPlaceholder("Elegir acción")
      .addOptions([{ label:`Quedarte con ${gold} monedas`,value:"take" },{ label:"Dejarlo",value:"leave" }]);
    message.reply({ ephemeral:true, content:`💀 Has encontrado el c4d4v3r de un explorador con ${gold} monedas. ¿Qué deseas hacer?`, components:[new ActionRowBuilder().addComponents(menu)] });
  }
});

// manejar eventos C4D4V3R
client.on(Events.StringSelectMenu,interaction=>{
  if(interaction.customId.startsWith("cadaver_choice_")){
    const user=getStatus(interaction.user.id);
    const gold=Math.floor(Math.random()*50+10);
    if(interaction.values[0]==="take"){
      user.money+=gold;
      if(Math.random()<0.01){
        const member=interaction.member;
        if(!member.roles.cache.has(ranks.narehate)){
          member.roles.add(ranks.narehate);
          interaction.update({ content:`💀 Te quedaste con las monedas (${gold}) y te transformaste en **narehate**!`, components:[] });
          saveStatus(); return;
        }
      }
      interaction.update({ content:`💀 Te quedaste con las monedas (${gold})`, components:[] });
      saveStatus();
    } else {
      interaction.update({ content:"💀 Decidiste dejar las monedas.", components:[] });
    }
  }
});

/* =====================
TOPS SYSTEM
===================== */
async function sendTops() {
  if (!config.channels.tops) return;

  const ch = await client.channels.fetch(config.channels.tops).catch(() => null);
  if (!ch) return;

  const users = Object.entries(status);

  const topMoney = [...users]
    .sort((a, b) => b[1].money - a[1].money)
    .slice(0, 5)
    .map((u, i) => `${i + 1}. <@${u[0]}> — 💰 ${u[1].money}`)
    .join("\n");

  const topMsg = [...users]
    .sort((a, b) => b[1].messages - a[1].messages)
    .slice(0, 5)
    .map((u, i) => `${i + 1}. <@${u[0]}> — 💬 ${u[1].messages}`)
    .join("\n");

  await ch.send(
    `🏆 **TOPS DEL ABISMO**\n\n💰 **Riqueza**\n${topMoney || "Sin datos"}\n\n💬 **Actividad**\n${topMsg || "Sin datos"}`
  );
}

setInterval(sendTops, 10 * 60 * 1000);

/* =====================
LOGIN
===================== */
client.login(TOKEN);

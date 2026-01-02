import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} from "discord.js";
import fs from "fs";
import express from "express";

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

if (!TOKEN || !CLIENT_ID) {
  console.error("Faltan variables de entorno");
  process.exit(1);
}

// ===================== EXPRESS KEEP ALIVE =====================
const app = express();
app.get("/", (_, res) => res.send("Belaf vigila el Abismo 🧭"));
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));

// ===================== CLIENT =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

// ===================== LOAD FILES =====================
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
const objects = JSON.parse(fs.readFileSync("objects.json", "utf8"));

// mapa rápido por nombre
const objectsMap = {};
Object.values(objects).flat().forEach(o => { objectsMap[o.name] = o; });

let users = fs.existsSync("users.json") ? JSON.parse(fs.readFileSync("users.json", "utf8")) : {};
const saveUsers = () => fs.writeFileSync("users.json", JSON.stringify(users, null, 2));

// ===================== USER INIT =====================
function getUser(id) {
  if (!users[id]) {
    users[id] = { money: 0, rank: "bell", inventory: {}, messages: 0 };
    saveUsers();
  }
  return users[id];
}

// ===================== DROP SYSTEM =====================
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  if (!config.channels.find.includes(message.channel.id)) return;

  const user = getUser(message.author.id);
  user.messages++;

  // drop cada 5 mensajes
  if (user.messages % 5 !== 0) { saveUsers(); return; }

  const index = config.channels.find.indexOf(message.channel.id);

  let pool = objects.class4;
  if (index >= 1) pool = objects.class3;
  if (index >= 2) pool = objects.class2;
  if (index >= 3) pool = objects.class1;
  if (index >= 4) pool = objects.special;

  const item = pool[Math.floor(Math.random() * pool.length)];

  if (!user.inventory[item.name]) user.inventory[item.name] = { item, qty: 1 };
  else user.inventory[item.name].qty++;

  saveUsers();
  message.reply(`🧭 **Belaf murmura:**\nHas encontrado **${item.name}**.`);
});

// ===================== COMMANDS =====================
const commands = [
  new SlashCommandBuilder().setName("inventory").setDescription("Ver tu inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver tu dinero actual"),
  new SlashCommandBuilder().setName("rankup").setDescription("Ascender de silbato"),
  new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Proponer un trueque a un Narehate")
    .addUserOption(o => o.setName("user").setDescription("Narehate").setRequired(true))
    .addStringOption(o => o.setName("give").setDescription("Objeto que ofreces").setRequired(true))
    .addStringOption(o => o.setName("want").setDescription("Objeto que quieres").setRequired(true)),
  new SlashCommandBuilder().setName("setchannelsreliquies").setDescription("Selecciona los canales para drops"),
  new SlashCommandBuilder().setName("setchanneltrade").setDescription("Selecciona el canal de trades"),
  new SlashCommandBuilder().setName("setchanneltop").setDescription("Selecciona el canal de tops"),
  new SlashCommandBuilder().setName("setchannelsell").setDescription("Selecciona el canal de venta")
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

// ===================== TOPS SYSTEM =====================
function sendTops(client) {
  const guild = client.guilds.cache.first();
  if (!guild) return;
  const channel = guild.channels.cache.get(config.channels.tops);
  if (!channel) return;

  const sortedMoney = Object.entries(users)
    .filter(([id, data]) => !guild.members.cache.get(id)?.roles.cache.some(r => r.name.toLowerCase() === config.roles.narehate.toLowerCase()))
    .sort((a,b) => b[1].money - a[1].money).slice(0,10);
  const sortedItems = Object.entries(users)
    .filter(([id, data]) => !guild.members.cache.get(id)?.roles.cache.some(r => r.name.toLowerCase() === config.roles.narehate.toLowerCase()))
    .sort((a,b) => {
      const sumaA = Object.values(a[1].inventory).reduce((p,c)=>p+c.qty,0);
      const sumaB = Object.values(b[1].inventory).reduce((p,c)=>p+c.qty,0);
      return sumaB-sumaA;
    }).slice(0,10);
  const sortedRank = Object.entries(users)
    .filter(([id, data]) => !guild.members.cache.get(id)?.roles.cache.some(r => r.name.toLowerCase() === config.roles.narehate.toLowerCase()))
    .sort((a,b)=>config.ranks.indexOf(b[1].rank)-config.ranks.indexOf(a[1].rank)).slice(0,10);

  const buildList = (arr, label, keyFn) => arr.map(([id,data],i)=>`${i+1}. ${guild.members.cache.get(id)?.user.username||"Desconocido"} — ${label} ${keyFn(data)}`).join("\n");

  const content = `@everyone
🏆 **Tops del Abismo**
💰 Dinero:\n${buildList(sortedMoney,"💰",d=>d.money)}
🎒 Reliquias:\n${buildList(sortedItems,"🧭",d=>Object.values(d.inventory).reduce((p,c)=>p+c.qty,0))}
🎖️ Rango:\n${buildList(sortedRank,"🎖️",d=>d.rank)}`;

  channel.send({ content });
}

// ===================== READY =====================
client.once(Events.ClientReady, async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("Belaf observa el Abismo");
  setInterval(()=>sendTops(client),5*60*1000);
});

// ===================== INTERACTIONS =====================
client.on(Events.InteractionCreate, async interaction => {

  // ================= BUTTONS TRADE =================
  if(interaction.isButton()){
    const [type, fromId, give, want] = interaction.customId.split(":");
    const fromUser = getUser(fromId);
    const toUser = getUser(interaction.user.id);

    if(type==="trade_reject") return interaction.update({content:"🔁 **Trueque rechazado.**",components:[]});
    if(type==="trade_accept"){
      if(!toUser.inventory[want]||toUser.inventory[want].qty<1)
        return interaction.reply({content:"No tienes el objeto solicitado.",ephemeral:true});

      fromUser.inventory[give].qty--;
      if(fromUser.inventory[give].qty<=0) delete fromUser.inventory[give];

      toUser.inventory[want].qty--;
      if(toUser.inventory[want].qty<=0) delete toUser.inventory[want];

      fromUser.inventory[want] ??= { item: objectsMap[want], qty:0 };
      toUser.inventory[give] ??= { item: objectsMap[give], qty:0 };

      fromUser.inventory[want].qty++;
      toUser.inventory[give].qty++;

      saveUsers();
      return interaction.update({content:"🔁 **Belaf asiente:** El trueque ha sido completado.",components:[]});
    }
  }

  if(!interaction.isChatInputCommand()) return;
  const user = getUser(interaction.user.id);

  // ================= INVENTORY =================
  if(interaction.commandName==="inventory"){
    const items = Object.values(user.inventory);
    if(!items.length) return interaction.reply({content:"🎒 Inventario vacío.",ephemeral:true});
    const text = items.map(e=>`• ${e.item.icon||"🧭"} ${e.item.name} x${e.qty}`).join("\n");
    return interaction.reply({content:`🎒 **Inventario:**\n${text}`,ephemeral:true});
  }

  // ================= MYMONEY =================
  if(interaction.commandName==="mymoney"){
    return interaction.reply({content:`💰 Tienes ${user.money} monedas.`,ephemeral:true});
  }

  // ================= RANKUP =================
  if(interaction.commandName==="rankup"){
    if(interaction.channel.id!==config.channels.rankup) return interaction.reply({content:"No aquí.",ephemeral:true});
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if(member.roles.cache.some(r=>r.name.toLowerCase()===config.roles.narehate.toLowerCase()))
      return interaction.reply({content:"🩸 **Belaf susurra:** Los Narehates ya no ascienden.",ephemeral:true});

    const idx = config.ranks.indexOf(user.rank);
    if(idx===-1||idx===config.ranks.length-1) return interaction.reply({content:"No puedes ascender más.",ephemeral:true});

    const nextRank = config.ranks[idx+1];
    const req = config.rankRequirements[user.rank];

    if(user.money<req.money) return interaction.reply({content:`Belaf exige **${req.money}** monedas.`,ephemeral:true});
    const entry = user.inventory[req.item];
    if(!entry||entry.qty<1) return interaction.reply({content:`Belaf exige **${req.item}**.`,ephemeral:true});

    user.money-=req.money;
    entry.qty--;
    if(entry.qty<=0) delete user.inventory[req.item];
    user.rank=nextRank;
    saveUsers();

    const newRole = interaction.guild.roles.cache.find(r=>r.name.toLowerCase().includes(nextRank.replace("_"," ")));
    if(newRole) await member.roles.add(newRole);

    return interaction.reply({content:`🎖️ **Belaf proclama:** Has ascendido a **${nextRank}**.`,ephemeral:true});
  }

  // ================= TRADE =================
  if(interaction.commandName==="trade"){
    if(interaction.channel.id!==config.channels.trade) return interaction.reply({content:"No aquí.",ephemeral:true});
    const target = interaction.options.getUser("user");
    const give = interaction.options.getString("give");
    const want = interaction.options.getString("want");
    if(!user.inventory[give]) return interaction.reply({content:"No tienes ese objeto.",ephemeral:true});

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`trade_accept:${interaction.user.id}:${give}:${want}`).setLabel("Aceptar").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("trade_reject").setLabel("Rechazar").setStyle(ButtonStyle.Danger)
    );

    return interaction.reply({
      content:`🔁 **Belaf anuncia:**\n${target}, **${interaction.user.username}** quiere cambiar su **${give}** por tu **${want}**.`,
      components:[row]
    });
  }

  // ================= SET CHANNELS RELIQUIES =================
  if(interaction.commandName==="setchannelsreliquies"){
    const guild = interaction.guild;
    const classOptions = [
      {label:"Canales Bells (objetos malos)",filter:c=>c.type===0&&c.name.toLowerCase().includes("bell")},
      {label:"Canales Silbato Blanco (objetos especiales)",filter:c=>c.type===0&&c.name.toLowerCase().includes("blanco")},
      {label:"Otros",filter:c=>c.type===0&&!c.name.toLowerCase().includes("bell")&&!c.name.toLowerCase().includes("blanco")}
    ];
    const rows=[];
    for(const cls of classOptions){
      const options=guild.channels.cache.filter(cls.filter).map(c=>({label:c.name,value:c.id}));
      if(!options.length) continue;
      const select=new StringSelectMenuBuilder().setCustomId(`set_channels_${cls.label}`).setPlaceholder(cls.label).setMinValues(1).setMaxValues(options.length).addOptions(options);
      rows.push(new ActionRowBuilder().addComponents(select));
    }
    return interaction.reply({content:"Selecciona los canales para cada clase de reliquias:",components:rows,ephemeral:true});
  }
});

// ===================== LOGIN =====================
client.login(TOKEN);

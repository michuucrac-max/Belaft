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

//// BLOQUE 5: ARCHIVOS Y FUNCIONES DE GUARDADO ASÍNCRONO ////
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

let saveTimeout;
const saveStatus = async () => {
  try {
    await fs.promises.writeFile(statusPath, JSON.stringify(status, null, 2));
  } catch (err) {
    console.error("❌ Error guardando status:", err);
  }
};
const queueSave = () => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveStatus, 500); // debounce para no bloquear
};

const saveConfig = async () => {
  try {
    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error("❌ Error guardando config:", err);
  }
};

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
    status[id] = { money: 0, rank: "Bell", humanity: true, inventory: {}, messages: 0 };
  }

  if (member) {
    const order = ["Bell","Silbato rojo","Silbato azul","Silbato lunar","Silbato negro","Silbato blanco","Narehate"];
    const roles = member.roles.cache.map(r => r.name);
    const found = [...order].reverse().find(r => roles.includes(r));
    if (found) status[id].rank = found;
    status[id].humanity = !member.roles.cache.has(NAREHATE_ROLE_ID);
  }

  queueSave();
  return status[id];
}

function getDiscordRank(member) {
  if (!member) return "Sin rango";
  if (member.roles.cache.has(NAREHATE_ROLE_ID)) return "Narehate";
  for (let i = RANK_ROLES.length - 1; i >= 0; i--) {
    if (member.roles.cache.has(RANK_ROLES[i].id)) return RANK_ROLES[i].name;
  }
  return "Sin rango";
}

//// BLOQUE 8: DROP SYSTEM ////
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  if (!config.channels.reliquies.includes(message.channel.id)) return;

  const depth = config.channels.reliquies.indexOf(message.channel.id);
  const user = getStatus(message.author.id, message.member);
  user.messages++;

  if (user.messages % 5 !== 0) return;

  const pools = [objects.class4, objects.class3, objects.class2, objects.special, objects.special, objects.special];
  const pool = pools[depth] ?? objects.class4;
  if (!pool.length) return;

  const item = pool[Math.floor(Math.random() * pool.length)];

  if (!user.inventory[item.name]) user.inventory[item.name] = { ...item, qty: 0 };
  user.inventory[item.name].qty++;
  queueSave();

  await message.reply(`🧭 Encontraste ${item.icon} ${item.name}`).catch(() => {});
});

//// BLOQUE 9: COMANDOS ////
const commands = [
  new SlashCommandBuilder().setName("inventory").setDescription("Ver inventario"),
  new SlashCommandBuilder().setName("mymoney").setDescription("Ver monedas"),
  new SlashCommandBuilder().setName("rankup").setDescription("Subir de rango"),
  new SlashCommandBuilder().setName("sell").setDescription("Vender reliquias").addStringOption(o =>
    o.setName("mode").setDescription("Modo de venta").setRequired(true)
      .addChoices({name:"Uno", value:"one"}, {name:"Todo", value:"all"})
  ),
  new SlashCommandBuilder().setName("trade").setDescription("Intercambiar reliquias").addUserOption(o =>
    o.setName("user").setDescription("Usuario").setRequired(true)
  ),
  new SlashCommandBuilder().setName("setchannelreliquies").setDescription("Configurar reliquias").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder().setName("setchanneltrade").setDescription("Configurar trade").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder().setName("setchannelsell").setDescription("Configurar sell").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder().setName("setchanneltops").setDescription("Configurar tops").setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
];

const rest = new REST({ version: "10" }).setToken(TOKEN);
const activeTrades = new Map(); // Trades activos

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
        if (!items.length) return interaction.reply({ ephemeral: true, content: "🎒 Tu inventario está vacío." });
        return interaction.reply({ ephemeral: true, content: items.map(i => `${i.icon} ${i.name} x${i.qty}`).join("\n") });
      }

      //// MY MONEY ////
      if (interaction.commandName === "mymoney") {
        return interaction.reply({ ephemeral: true, content: `💰 Tienes ${user.money} monedas.` });
      }

      //// SELL ////
      if (interaction.commandName === "sell") {
        const mode = interaction.options.getString("mode");
        const invItems = Object.values(user.inventory);
        if (!invItems.length) return interaction.reply({ ephemeral: true, content: "🎒 No tienes reliquias para vender." });

        if (mode === "one") {
          const item = invItems[0];
          user.money += item.price ?? 0;
          item.qty--; if(item.qty <= 0) delete user.inventory[item.name];
          queueSave();
          return interaction.reply({ content: `💰 Vendiste 1 ${item.icon} ${item.name} por ${item.price} monedas.` });
        }
        if (mode === "all") {
          let total = 0;
          invItems.forEach(item => { total += (item.price ?? 0)*item.qty; delete user.inventory[item.name]; });
          user.money += total;
          queueSave();
          return interaction.reply({ content: `💰 Vendiste todo tu inventario por ${total} monedas.` });
        }
      }

      //// TRADE ////
      if (interaction.commandName === "trade") {
        const targetUser = interaction.options.getUser("user");
        if (!targetUser || targetUser.id === interaction.user.id) return interaction.reply({ ephemeral: true, content: "❌ Usuario inválido o igual a ti." });

        const fromUser = getStatus(interaction.user.id, interaction.member);
        const toUser = getStatus(targetUser.id);

        if (!Object.keys(fromUser.inventory).length) return interaction.reply({ ephemeral:true, content:"🎒 No tienes objetos para ofrecer." });
        if (!Object.keys(toUser.inventory).length) return interaction.reply({ ephemeral:true, content:`${targetUser.tag} no tiene objetos para intercambiar.` });

        const selectMenu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`trade_select_${interaction.user.id}_${targetUser.id}`)
            .setPlaceholder("Selecciona un objeto para ofrecer")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(Object.values(fromUser.inventory).map(i => ({
              label:`${i.name} (x${i.qty})`,
              value:i.name,
              description:`Precio: ${i.price}`,
              emoji:i.icon
            })))
        );

        return interaction.reply({ ephemeral:true, content:`🔄 Selecciona un objeto para ofrecer a ${targetUser.tag}:`, components:[selectMenu] });
      }
    }

    //// MENÚ DE SELECCIÓN DE OBJETOS ////
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("trade_select_") && !interaction.customId.endsWith("_response")) {
      const [_, fromId, toId] = interaction.customId.split("_");
      const selectedItemName = interaction.values[0];
      const trade = { from: fromId, to: toId, fromItem: selectedItemName, fromQty:1, toItem:null, toQty:0, confirmed:{from:false,to:false}, timeout:null };
      activeTrades.set(fromId, trade);

      const toMember = await interaction.guild.members.fetch(toId).catch(()=>null);
      if(!toMember) return interaction.reply({ephemeral:true, content:"❌ Usuario no encontrado."});
      const toStatus = getStatus(toId);

      const selectMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`trade_select_${fromId}_${toId}_response`)
          .setPlaceholder(`${toMember.user.tag}, selecciona el objeto que deseas ofrecer`)
          .setMinValues(1).setMaxValues(1)
          .addOptions(Object.values(toStatus.inventory).map(i => ({
            label:`${i.name} (x${i.qty})`,
            value:i.name,
            description:`Precio: ${i.price}`,
            emoji:i.icon
          })))
      );

      await interaction.followUp({ ephemeral:true, content:`📩 ${toMember.user.tag}, selecciona un objeto para ofrecer...`, components:[selectMenu] });
    }

    //// RESPUESTA DEL SEGUNDO USUARIO ////
    if (interaction.isStringSelectMenu() && interaction.customId.endsWith("_response")) {
      const [_, fromId, toId] = interaction.customId.split("_");
      const trade = activeTrades.get(fromId);
      if(!trade) return interaction.reply({ephemeral:true, content:"❌ Trade no encontrado o expirado."});

      trade.toItem = interaction.values[0];
      trade.toQty = 1;
      activeTrades.set(fromId, trade);

      const fromMember = await interaction.guild.members.fetch(fromId).catch(()=>null);
      const toMember = await interaction.guild.members.fetch(toId).catch(()=>null);

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("Aceptar").setStyle(ButtonStyle.Success).setCustomId(`trade_confirm_${fromId}_${toId}_accept`),
        new ButtonBuilder().setLabel("Rechazar").setStyle(ButtonStyle.Danger).setCustomId(`trade_confirm_${fromId}_${toId}_reject`)
      );

      await interaction.followUp({ ephemeral:true, content:`🔄 Trade propuesto:\n${fromMember.user.tag} ofrece ${trade.fromItem} x${trade.fromQty}\n${toMember.user.tag} ofrece ${trade.toItem} x${trade.toQty}\nAmbos deben confirmar en 2 minutos.`, components:[confirmRow] });

      trade.timeout = setTimeout(() => { activeTrades.delete(fromId); interaction.followUp({ephemeral:true, content:"⏰ El trade expiró."}) }, 2*60*1000);
    }

    //// BOTONES DE CONFIRMACIÓN ////
    if (interaction.isButton() && interaction.customId.startsWith("trade_confirm_")) {
      const [_, fromId, toId, action] = interaction.customId.split("_");
      const trade = activeTrades.get(fromId);
      if(!trade) return interaction.reply({ephemeral:true, content:"❌ Trade no encontrado o expirado."});

      const role = interaction.user.id === fromId ? "from" : "to";
      if(action === "accept") trade.confirmed[role] = true;
      else if(action === "reject"){ clearTimeout(trade.timeout); activeTrades.delete(fromId); return interaction.update({content:"❌ Trade rechazado.", components:[]}); }

      if(trade.confirmed.from && trade.confirmed.to){
        const fromStatus = getStatus(fromId);
        const toStatus = getStatus(toId);

        const fromItem = fromStatus.inventory[trade.fromItem];
        const toItem = toStatus.inventory[trade.toItem];

        fromItem.qty -= trade.fromQty; if(fromItem.qty<=0) delete fromStatus.inventory[trade.fromItem];
        toItem.qty -= trade.toQty; if(toItem.qty<=0) delete toStatus.inventory[trade.toItem];

        if(!toStatus.inventory[trade.fromItem]) toStatus.inventory[trade.fromItem] = {...fromItem, qty:0};
        if(!fromStatus.inventory[trade.toItem]) fromStatus.inventory[trade.toItem] = {...toItem, qty:0};

        toStatus.inventory[trade.fromItem].qty += trade.fromQty;
        fromStatus.inventory[trade.toItem].qty += trade.toQty;

        queueSave();
        clearTimeout(trade.timeout);
        activeTrades.delete(fromId);

        return interaction.update({content:"✅ Trade completado correctamente.", components:[]});
      }
      await interaction.update({components:interaction.message.components});
    }

  } catch(err){ console.error("❌ Interaction error:", err); }
});

//// BLOQUE 11: LOGIN CLIENT ////
client.login(TOKEN).then(()=>console.log("🤖 Bot online")).catch(err=>console.error("❌ Error al loguear bot:", err));

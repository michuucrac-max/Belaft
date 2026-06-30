/* ==========================
          IMPORTS
========================== */

import fs from "fs";
import objects from "./objects.json" with { type: "json" };
import {
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    StringSelectMenuBuilder,
    ChannelType,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle
} from "discord.js";

/* ==========================
           RUTAS
========================== */

const CONFIG_PATH = "./config.json";
const STATUS_PATH = "./status.json";

const RELIC_CHANCE = 0.005;

/* ==========================
        SISTEMA XP
========================== */

const XP_COOLDOWN = new Map();

/* ==========================
           CONFIG
========================== */

let config = {
    channels: {
        reliquies: null
    }
};

let status = {};

/* ==========================
      INICIALIZACIÓN
========================== */

loadConfig();
loadStatus();

/* ==========================
        CONFIG.JSON
========================== */

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        saveConfig();
        return;
    }

    try {
        config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    } catch {
        console.log("⚠️ config.json corrupto. Restaurando...");
        config = { channels: {} };
        saveConfig();
    }

    if (!config.channels) config.channels = {};
}

function saveConfig() {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4), "utf8");
        console.log("✅ config.json guardado correctamente");
    } catch (err) {
        console.error("❌ Error guardando config.json:", err);
    }
}

/* ==========================
        STATUS.JSON
========================== */

function loadStatus() {
    if (!fs.existsSync(STATUS_PATH)) {
        status = {};
        saveStatus();
        return;
    }

    try {
        const data = fs.readFileSync(STATUS_PATH, "utf8");
        status = data.trim() ? JSON.parse(data) : {};
    } catch (err) {
        console.log("⚠️ status.json corrupto. Restaurando...");
        console.error(err);
        status = {};
        saveStatus();
    }
}

function saveStatus() {
    try {
        fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 4), "utf8");
        console.log("✅ status.json guardado correctamente");
    } catch (err) {
        console.error("❌ Error guardando status.json:", err);
    }
}

/* ==========================
        OBTENER USUARIO
========================== */

function getUser(guildId, userId) {
    if (!status[guildId]) status[guildId] = {};
    if (!status[guildId][userId]) {
        status[guildId][userId] = {
            money: 0,
            xp: 0,
            rank: 0,
            multiplier: 1,
            daily: 0,
            inventory: {},
            stats: { reliquies: 0, sold: 0 }
        };
        saveStatus();
    }

    const user = status[guildId][userId];

    if (typeof user.money !== "number") user.money = 0;
    if (typeof user.xp !== "number") user.xp = 0;
    if (typeof user.rank !== "number") user.rank = 0;
    if (typeof user.multiplier !== "number") user.multiplier = 1;
    if (typeof user.daily !== "number") user.daily = 0;
    if (!user.inventory) user.inventory = {};
    if (!user.stats) user.stats = { reliquies: 0, sold: 0 };
    if (typeof user.stats.reliquies !== "number") user.stats.reliquies = 0;
    if (typeof user.stats.sold !== "number") user.stats.sold = 0;

    saveStatus();
    return user;
}

/* ==========================
   SINCRONIZAR RANGO CON ROLES
========================== */

function syncUserRank(interaction, user) {
  const ranks = config.ranks;

  // recorrer de arriba hacia abajo para encontrar el rango más alto que tenga el usuario
  for (let i = ranks.length - 1; i >= 0; i--) {
    const role = findGuildRole(interaction.guild, ranks[i]);
    if (role && interaction.member.roles.cache.has(role.id)) {
      user.rank = i; // sincronizar índice con el rol real
      break;
    }
  }
}

/* ==========================
      OBJETOS ALEATORIOS
========================== */

function getRandom(min, max) {

    return Math.floor(

        Math.random() * (max - min + 1)

    ) + min;

}

function getRandomClass() {

    const chances = {

        ultra: 0.1,
        special: 1,
        class1: 5,
        class2: 14,
        class3: 30,
        class4: 49.9

    };

    const roll = Math.random() * 100;

    let total = 0;

    for (const category in chances) {

        total += chances[category];

        if (roll <= total) {

            return category;

        }

    }

    return "class4";

}

function getRandomObject() {

    const category = getRandomClass();

    const list = objects[category];

    if (!list || list.length === 0) {

        return null;

    }

    const item = list[getRandom(0, list.length - 1)];

    return {

        ...item,

        id: `${category}:${item.name}`

    };

}

/* ==========================
      FUNCIONES RANGOS
========================== */

const ROLE_ALIASES = {

    bell: [
        "bell",
        "campanilla"
    ],

    silbato_rojo: [
        "silbato rojo",
        "rojo"
    ],

    silbato_azul: [
        "silbato azul",
        "azul"
    ],

    silbato_lunar: [
        "silbato lunar",
        "lunar"
    ],

    silbato_negro: [
        "silbato negro",
        "negro"
    ],

    silbato_blanco: [
        "silbato blanco",
        "blanco"
    ],

    narehate: [
        "narehate"
    ]

};

function normalizeRole(name) {

    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N} ]/gu, "")
        .replace(/\s+/g, " ")
        .trim();

}

function findGuildRole(guild, rankKey) {

    const aliases = ROLE_ALIASES[rankKey] ?? [];

    return guild.roles.cache.find(role => {

        const name = normalizeRole(role.name);

        return aliases.some(alias => name.includes(alias));

    });

}

/* ==========================
           LÓGICA
========================== */

export async function executeLogic(interaction, client) {

/* ==========================
    SELECT MENUS
========================== */

if (
    interaction.isChannelSelectMenu() ||
    interaction.isStringSelectMenu()
) {

    return handleChannelMenus(interaction);

}

/* ==========================
       BOTONES
========================== */

if (interaction.isButton()) {

    // ===== BOTONES DE SUGERENCIAS =====

    if (

        interaction.customId === "suggest_accept" ||

        interaction.customId === "suggest_progress" ||

        interaction.customId === "suggest_reject"

    ) {

        // Solo el desarrollador
        if (interaction.user.id !== "1427297946151551148") {

            return interaction.reply({

                content: "❌ Solo el desarrollador puede gestionar las sugerencias.",

                ephemeral: true

            });

        }

        const embed = EmbedBuilder.from(interaction.message.embeds[0]);

        let status = "";

        switch (interaction.customId) {

            case "suggest_accept":
                status = "✅ Aceptada";
                break;

            case "suggest_progress":
                status = "🛠️ En progreso";
                break;

            case "suggest_reject":
                status = "❌ Rechazada";
                break;

        }

        const fields = embed.data.fields.map(field => {

            if (field.name === "📌 Estado") {

                return {

                    name: "📌 Estado",

                    value: status,

                    inline: field.inline

                };

            }

            return field;

        });

        embed.setFields(fields);

        return interaction.update({

            embeds: [embed],

            components: interaction.message.components

        });

    }

    // ===== RESTO DE BOTONES =====

    /* ==========================
        RESET BUTTONS
========================== */

if (

    interaction.customId === "reset_confirm" ||

    interaction.customId === "reset_cancel"

) {

    // Solo administradores o el desarrollador
    if (

        !interaction.member.permissions.has("Administrator") &&

        interaction.user.id !== "1427297946151551148"

    ) {

        return interaction.reply({

            content: "❌ No tienes permiso.",

            ephemeral: true

        });

    }

    // Cancelar
    if (interaction.customId === "reset_cancel") {

        return interaction.update({

            content: "✅ Reinicio cancelado.",

            components: []

        });

    }

    // Reiniciar únicamente los usuarios de este servidor
const guildStatus = status[interaction.guild.id];

if (guildStatus) {

    for (const id in guildStatus) {

        guildStatus[id].money = 0;
        guildStatus[id].xp = 0;
        guildStatus[id].rank = 0;
        guildStatus[id].multiplier = 1;
        guildStatus[id].daily = 0;
        guildStatus[id].inventory = {};

        guildStatus[id].stats = {

            reliquies: 0,

            sold: 0

        };

    }

}

saveStatus();

    // Quitar únicamente los roles del bot
    const rolesToRemove = [

        "Bell",

        "Campanilla",

        "Silbato Rojo",

        "Silbato Azul",

        "Silbato Lunar",

        "Silbato Negro"


    ];

    for (const member of interaction.guild.members.cache.values()) {

        for (const role of member.roles.cache.values()) {

            const normalize = text =>
    text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}]/gu, "")
        .toLowerCase();

const roleName = normalize(role.name);

const shouldRemove = rolesToRemove.some(r =>
    roleName.includes(normalize(r))
);

            if (shouldRemove) {

                await member.roles.remove(role).catch(() => {});

            }

        }

    }

    return interaction.update({

        content: "✅ El progreso del servidor fue reiniciado correctamente.",

        components: []

    });

}
}

    /* ==========================
            MODALES
    ========================== */

    if (interaction.isModalSubmit()) {

        return handleModals(interaction);

    }


    /* ==========================
        SLASH COMMANDS
    ========================== */

    if (!interaction.isChatInputCommand()) return;

    return handleSlashCommands(interaction, client);

}


/* ==========================
      SELECT MENUS
========================== */

async function handleChannelMenus(interaction) {

    switch (interaction.customId) {

        /* ==========================
         SET RELIQUIES CHANNEL
        ========================== */

        case "set_reliquies_channel": {

            config.channels[interaction.guild.id] ??= {};

config.channels[interaction.guild.id].reliquies = interaction.values[0];

            saveConfig();

            return interaction.update({

                content:
`✅ Canal configurado correctamente.

📍 Canal:
<#${interaction.values[0]}>

Las reliquias aparecerán automáticamente en este canal.`,

                components: []

            });

        }

          /* ==========================
          SELL ITEM
          ========================== */

case "sell_item": {

    const user = getUser(interaction.guild.id, interaction.user.id);

    const id = interaction.values[0];

    if (!user.inventory[id]) {

        return interaction.update({

            content: "❌ Ya no tienes esa reliquia.",

            components: []

        });

    }

    let found = null;

    for (const category of [

        "class4",
        "class3",
        "class2",
        "class1",
        "special",
        "ultra"

    ]) {

        if (!objects[category]) continue;

        for (const item of objects[category]) {

            const itemId = `${category}:${item.name}`;

            if (itemId === id) {

                found = item;

                break;

            }

        }

        if (found) break;

    }

    if (!found) {

        return interaction.update({

            content: "❌ No se encontró la reliquia.",

            components: []

        });

    }

    if (found.soulbound) {

        return interaction.update({

            content: "🔒 Esa reliquia no puede venderse.",

            components: []

        });

    }

    user.inventory[id]--;

    if (user.inventory[id] <= 0) {

        delete user.inventory[id];

    }

    if (typeof user.money !== "number")
        user.money = 0;

    if (!user.stats)
        user.stats = { reliquies: 0, sold: 0 };

    if (typeof user.stats.sold !== "number")
        user.stats.sold = 0;

    if (typeof user.multiplier !== "number")
        user.multiplier = 1;

    const basePrice = found.value ?? found.price ?? 0;

    const price = Math.floor(basePrice * user.multiplier);

    user.money += price;

    user.stats.sold++;

    saveStatus();

    return interaction.update({

        content:
`💰 Has vendido:

${found.icon} **${found.name}**

📈 Multiplicador: **x${user.multiplier}**

Ganaste **${price}** monedas.

💵 Dinero actual: **${user.money}**`,

        components: []

    });

}
                        
         /* ==========================
          SHOP BUY
         ========================== */

case "shop_buy": {

    const user = getUser(interaction.guild.id, interaction.user.id);

    const multiplier = parseFloat(interaction.values[0]);

    let price = 0;

    switch (multiplier) {

        case 1.1:
            price = 1000;
            break;

        case 1.25:
            price = 15000;
            break;

        case 1.5:
            price = 30000;
            break;

        case 2:
            price = 100000;
            break;

        case 3:
            price = 5000000;
            break;

        default:

            return interaction.update({

                content: "❌ Mejora inválida.",

                components: []

            });

    }

    if (user.multiplier >= multiplier) {

        return interaction.update({

            content:
`❌ Ya tienes un multiplicador igual o superior.

📈 Multiplicador actual: **x${user.multiplier}**`,

            components: []

        });

    }

    if (user.xp < price) {

        return interaction.update({

            content:
`❌ No tienes suficiente XP.

⭐ Necesitas **${price} XP**
⭐ Tienes **${user.xp} XP**`,

            components: []

        });

    }

    user.xp -= price;

    user.multiplier = multiplier;

    saveStatus();

    return interaction.update({

        content:
`# 🎉 Compra realizada

📈 Nuevo multiplicador: **x${multiplier}**

⭐ XP restante: **${user.xp}**`,

        components: []

    });

}

/* ==========================
    SET CHANNEL RANKUP
========================== */

case "set_rankup_channel": {

    config.channels[interaction.guild.id] ??= {};

config.channels[interaction.guild.id].rankup = interaction.values[0];

    saveConfig();

    return interaction.update({

        content:
`✅ Canal de ascensos configurado.

🏆 Canal:
<#${interaction.values[0]}>

Los ascensos se anunciarán aquí.`,

        components: []

    });

}

         /* ==========================
         SET TOP CHANNEL
         ========================== */

case "set_top_channel": {

    config.channels[interaction.guild.id] ??= {};

config.channels[interaction.guild.id].tops = interaction.values[0];

    saveConfig();

    return interaction.update({

        content:
`✅ Canal del ranking configurado.

🏆 Canal:
<#${interaction.values[0]}>

El Top automático aparecerá aquí.`,

        components: []

    });

}

        /* ==========================
            DESCONOCIDO
        ========================== */

        default: {

            return interaction.reply({

                content: "❌ Menú desconocido.",

                ephemeral: true

            });

        }

    }

}


/* ==========================
          BOTONES
========================== */

async function handleButtons(interaction) {

    switch (interaction.customId) {

        default: {

            return interaction.reply({

                content: "⚠️ Este botón aún no está implementado.",

                ephemeral: true

            });

        }

    }

}


/* ==========================
          MODALES
========================== */

async function handleModals(interaction) {

    switch (interaction.customId) {

        default: {

            return interaction.reply({

                content: "⚠️ Este formulario aún no está implementado.",

                ephemeral: true

            });

        }

    }

}


/* ==========================
      SLASH COMMANDS
========================== */

async function handleSlashCommands(interaction, client) {

    switch (interaction.commandName) {

        /* ==========================
                PING
        ========================== */

        case "ping": {

            return interaction.reply("🏓 Pong!");

        }


        /* ==========================
               AVATAR
        ========================== */

        case "avatar": {

            return interaction.reply(

                interaction.user.displayAvatarURL({

                    size: 1024

                })

            );

        }


        /* ==========================
             USER INFO
        ========================== */

        case "userinfo": {

            return interaction.reply(

`👤 Usuario: ${interaction.user.username}
🆔 ID: ${interaction.user.id}`

            );

        }


        /* ==========================
            SERVER INFO
        ========================== */

        case "server": {

            return interaction.reply(

`🌐 Servidor: ${interaction.guild.name}
👥 Miembros: ${interaction.guild.memberCount}`

            );

        }

/* ==========================
            HELP
========================== */

case "help": {

    const embed = new EmbedBuilder()

        .setColor(0x6A4CFF)

        .setTitle("📖 Belaft • Centro de Ayuda")

        .setDescription(
`Bienvenido al sistema de reliquias de **Belaft**.

Aquí encontrarás todos los comandos disponibles y una breve explicación de cada uno.

━━━━━━━━━━━━━━━━━━`
        )

        .addFields(

            {
                name: "⚡ Información",
                value:
"🏓 **/ping**\nComprueba si Belaft está en línea.\n\n" +

"📖 **/help**\nMuestra este centro de ayuda.\n\n" +

"🖼️ **/avatar**\nMuestra el avatar de un usuario.\n\n" +

"👤 **/userinfo**\nConsulta información de un usuario.\n\n" +

"🌐 **/server**\nMuestra información del servidor.",
                inline: false
            },

            {
                name: "🎒 Reliquias",
                value:
"🎒 **/inventory**\nConsulta todas tus reliquias.\n\n" +

"💸 **/sell**\nVende una reliquia o todo tu inventario.\n\n" +

"🛒 **/shop**\nCompra multiplicadores usando XP.",
                inline: false
            },

            {
                name: "💰 Economía",
                value:
"💰 **/mymoney**\nConsulta tu dinero, XP y rango.\n\n" +

"👁️ **/seemoney**\nConsulta el dinero, XP y rango de otro usuario.\n\n" +

"🎁 **/daily**\nReclama tu recompensa diaria.\n\n" +

"⬆️ **/rankup**\nAsciende al siguiente rango cuando cumplas los requisitos.",
                inline: false
            },

            {
                name: "💡 Comunidad",
                value:
"💭 **/suggestion**\nEnvía una sugerencia directamente al desarrollador.",
                inline: false
            },

            {
                name: "🛠️ Administración",
                value:
"💰 **/setmoney**\nEstablece el dinero de un usuario.\n\n" +

"⭐ **/setxp**\nEstablece el XP de un usuario.\n\n" +

"📡 **/setchannelreliquies**\nConfigura el canal donde aparecerán reliquias.\n\n" +

"🏆 **/setchanneltop**\nConfigura el canal del ranking automático.\n\n" +
                          
"🔼 **/setchannelrankup**\nConfigura el canal donde aparecera el rankup.\n\n" +

"♻️ **/reset**\nReinicia el progreso económico del servidor.",
                inline: false
            }

        )

        .setFooter({

            text: "Belaft • Made in Abyss RPG | Gracias por usar Belaft ❤️"

        });

    return interaction.reply({

        embeds: [embed],

        ephemeral: true

    });

}
                        
/* ==========================
          MY MONEY
========================== */

case "mymoney": {

    const user = getUser(interaction.guild.id, interaction.user.id);

    const member = await interaction.guild.members.fetch(interaction.user.id);

    let rank = "Bell";

    if (findGuildRole(interaction.guild, "narehate")?.id &&
        member.roles.cache.has(findGuildRole(interaction.guild, "narehate").id))
        rank = "Narehate";

    else if (findGuildRole(interaction.guild, "silbato_blanco")?.id &&
        member.roles.cache.has(findGuildRole(interaction.guild, "silbato_blanco").id))
        rank = "Silbato Blanco";

    else if (findGuildRole(interaction.guild, "silbato_negro")?.id &&
        member.roles.cache.has(findGuildRole(interaction.guild, "silbato_negro").id))
        rank = "Silbato Negro";

    else if (findGuildRole(interaction.guild, "silbato_lunar")?.id &&
        member.roles.cache.has(findGuildRole(interaction.guild, "silbato_lunar").id))
        rank = "Silbato Lunar";

    else if (findGuildRole(interaction.guild, "silbato_azul")?.id &&
        member.roles.cache.has(findGuildRole(interaction.guild, "silbato_azul").id))
        rank = "Silbato Azul";

    else if (findGuildRole(interaction.guild, "silbato_rojo")?.id &&
        member.roles.cache.has(findGuildRole(interaction.guild, "silbato_rojo").id))
        rank = "Silbato Rojo";

    return interaction.reply({

        content:
`# 💰 Tu perfil

🪙 Monedas: **${user.money}**

🎖️ Rango: **${rank}**
⭐ XP: **${user.xp}**
📈 Multiplicador: **x${user.multiplier}**

━━━━━━━━━━━━━━

📦 Reliquias encontradas: **${user.stats.reliquies}**
💸 Reliquias vendidas: **${user.stats.sold}**`,

        ephemeral: true

    });

}

        /* ==========================
             INVENTORY
        ========================== */

        case "inventory": {

            const user = getUser(interaction.guild.id, interaction.user.id);
                  
            if (!Object.keys(user.inventory).length) {

                return interaction.reply({

                          content:
           `# 🎒 Inventario No tienes ninguna reliquia todavía.`,
              
                          ephemeral: true

                 });

            }

            let text = "# 🎒 Inventario\n\n";

            let totalItems = 0;
            let totalValue = 0;

            for (const category of [

                "class4",
                "class3",
                "class2",
                "class1",
                "special",
                "ultra"

            ]) {

                if (!objects[category]) continue;

                for (const item of objects[category]) {

                    const id = `${category}:${item.name}`;

const amount = user.inventory[id];

if (!amount) continue;

const baseValue = item.value ?? item.price ?? 0;

const sellValue = Math.floor(baseValue * (user.multiplier ?? 1));

totalItems += amount;

totalValue += sellValue * amount;

text +=
`${item.icon} **${item.name}**
Cantidad: **${amount}**
Valor base: **${baseValue}**
📈 Multiplicador: **x${user.multiplier ?? 1}**
💰 Valor de venta: **${sellValue}**

`;
                
                }
            }

            text +=
`━━━━━━━━━━━━━━

📦 Total de objetos: **${totalItems}**
💰 Valor total: **${totalValue}**`;

            return interaction.reply({

               content: text,

               ephemeral: true

          });
                  
        }

/* ==========================
            SELL
========================== */

case "sell": {

    const user = getUser(interaction.guild.id, interaction.user.id);

    if (!Object.keys(user.inventory).length) {

        return interaction.reply({

            content: "❌ No tienes reliquias para vender.",

            ephemeral: true

        });

    }

    const mode = interaction.options.getString("modo");

    // ==========================
    // VENDER TODO
    // ==========================

    if (mode === "all") {

        let totalMoney = 0;
        let totalItems = 0;

        for (const category of [

            "class4",
            "class3",
            "class2",
            "class1",
            "special",
            "ultra"

        ]) {

            if (!objects[category]) continue;

            for (const item of objects[category]) {

                const id = `${category}:${item.name}`;

                const amount = user.inventory[id];

                if (!amount) continue;

                // No vender reliquias bloqueadas
                if (item.soulbound) continue;

                const basePrice = item.value ?? item.price ?? 0;

                totalMoney += Math.floor(basePrice * user.multiplier) * amount;

                totalItems += amount;

                delete user.inventory[id];

            }

        }

        if (totalItems === 0) {

            return interaction.reply({

                content: "❌ No tienes reliquias que puedan venderse.",

                ephemeral: true

            });

        }

        user.money += totalMoney;
        user.stats.sold += totalItems;

        saveStatus();

        return interaction.reply({

            content:
`💰 Has vendido **${totalItems}** reliquias.

📈 Multiplicador: **x${user.multiplier}**

🪙 Ganaste **${totalMoney}** monedas.

💵 Dinero actual: **${user.money}**`,

            ephemeral: true

        });

    }

    // ==========================
    // VENDER UNA
    // ==========================

    const options = [];

    for (const category of [

        "class4",
        "class3",
        "class2",
        "class1",
        "special",
        "ultra"

    ]) {

        if (!objects[category]) continue;

        for (const item of objects[category]) {

            const id = `${category}:${item.name}`;

            const amount = user.inventory[id];

            if (!amount) continue;

            options.push({

                label: item.name,

                description: `Tienes ${amount} • Valor ${item.value ?? item.price}`,

                value: id,

                emoji: item.icon

            });

        }

    }

    if (!options.length) {

        return interaction.reply({

            content: "❌ No tienes reliquias para vender.",

            ephemeral: true

        });

    }

    const row = new ActionRowBuilder()

        .addComponents(

            new StringSelectMenuBuilder()

                .setCustomId("sell_item")

                .setPlaceholder("Selecciona una reliquia")

                .addOptions(options.slice(0, 25))

        );

    return interaction.reply({

        content: "💰 ¿Qué reliquia deseas vender?",

        components: [row],

        ephemeral: true

    });

}

/* ==========================
          RANKUP
========================== */

case "rankup": {
  try {
    const user = getUser(interaction.guild.id, interaction.user.id);

    // 🔥 sincronizar rango con roles actuales
    syncUserRank(interaction, user);

    const ranks = config.ranks;
    const currentRank = ranks[user.rank] ?? "bell";
    const nextRank = ranks[user.rank + 1];
    const cost = config.rankCosts[nextRank] ?? 0;

        if (!config.ranks || !Array.isArray(config.ranks)) {
            return interaction.reply({
                content: "❌ Error: config.ranks no está configurado.",
                ephemeral: true
            });
        }

        if (!config.rankCosts) {
            return interaction.reply({
                content: "❌ Error: config.rankCosts no está configurado.",
                ephemeral: true
            });
        }

        const ranks = config.ranks;
        const currentRank = ranks[user.rank] ?? "bell";

        // Buscar índice real del rango actual
        const currentIndex = ranks.indexOf(currentRank);

        // Último rango
        if (currentIndex === -1 || currentIndex >= ranks.length - 1) {
            return interaction.reply({
                content: `🏆 ¡Ya posees el rango máximo!\n\n🎖️ **${currentRank}**`,
                ephemeral: true
            });
        }

        const nextRank = ranks[currentIndex + 1];

        // Rangos exclusivos
        if (nextRank === "silbato_blanco" || nextRank === "narehate") {
            return interaction.reply({
                content: `🏆 Has alcanzado el rango máximo que puede obtenerse mediante ascenso.\n\n🤍 **Silbato Blanco** solo puede ser concedido por la Organización.\n\n👁️ **Narehate** es un rango exclusivo del desarrollador.`,
                ephemeral: true
            });
        }

        const cost = config.rankCosts[nextRank] ?? 0;

        if (user.money < cost) {
            return interaction.reply({
                content: `❌ No tienes suficientes monedas.\n\n💰 Necesitas: **${cost}**\n🪙 Tienes: **${user.money}**`,
                ephemeral: true
            });
        }

        // Aplicar coste y actualizar rango
        user.money -= cost;
        user.rank = currentIndex + 1; // sincronizar con el array
        saveStatus();

        // Actualizar roles en Discord
        const oldRole = findGuildRole(interaction.guild, currentRank);
        const newRole = findGuildRole(interaction.guild, nextRank);

        if (oldRole) await interaction.member.roles.remove(oldRole).catch(console.error);
        if (newRole) await interaction.member.roles.add(newRole).catch(console.error);

        // Canal de ascensos
        const rankupChannel = config.channels?.[interaction.guild.id]?.rankup;
        if (rankupChannel) {
            const channel = interaction.guild.channels.cache.get(rankupChannel);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle("🎉 ¡Un explorador ha ascendido!")
                    .setDescription(`${interaction.user} ha ascendido de rango.`)
                    .addFields({
                        name: "🎖️ Nuevo rango",
                        value: config.roles[nextRank] ?? nextRank,
                        inline: true
                    })
                    .setTimestamp();

                await channel.send({
                    content: `📢 ${interaction.user}`,
                    embeds: [embed]
                }).catch(console.error);
            }
        }

        return interaction.reply({
            content: `🎉 ¡Ascendiste de rango!\n\n🎖️ Nuevo rango: **${config.roles[nextRank] ?? nextRank}**\n\n💰 Coste: **${cost}**\n🪙 Dinero restante: **${user.money}**`,
            ephemeral: true
        });

    } catch (err) {
        console.error("Error en /rankup:", err);
        return interaction.reply({
            content: `❌ Ocurrió un error.\n\`\`\`\n${err.message}\n\`\`\``,
            ephemeral: true
        }).catch(() => {});
    }
}
                        
         /* ==========================
         SHOP
         ========================== */

case "shop": {

const user = getUser(interaction.guild.id, interaction.user.id);

    const row = new ActionRowBuilder()

        .addComponents(

            new StringSelectMenuBuilder()

                .setCustomId("shop_buy")

                .setPlaceholder("Selecciona una mejora")

                .addOptions([

                    {
                        label: "Multiplicador x1.10",
                        description: "100 XP",
                        value: "1.1",
                        emoji: "📈"
                    },

                    {
                        label: "Multiplicador x1.25",
                        description: "250 XP",
                        value: "1.25",
                        emoji: "📈"
                    },

                    {
                        label: "Multiplicador x1.50",
                        description: "600 XP",
                        value: "1.5",
                        emoji: "📈"
                    },

                    {
                        label: "Multiplicador x2",
                        description: "1500 XP",
                        value: "2",
                        emoji: "📈"
                    },

                    {
                        label: "Multiplicador x3",
                        description: "4000 XP",
                        value: "3",
                        emoji: "📈"
                    }

                ])

        );

    return interaction.reply({

        content:
`# 🛒 Tienda

⭐ Tu XP: **${user.xp}**

📈 Multiplicador actual: **x${user.multiplier}**

Compra un multiplicador permanente.`,

        components: [row],

        ephemeral: true

    });

}
                        
        /* ==========================
          SEE MONEY
        ========================== */

case "seemoney": {

    const target = interaction.options.getUser("usuario");

    const user = getUser(interaction.guild.id, target.id);

    const member = await interaction.guild.members.fetch(target.id);

    let rank = "Bell";

    if (findGuildRole(interaction.guild, "narehate")?.id &&
        member.roles.cache.has(findGuildRole(interaction.guild, "narehate").id))
        rank = "Narehate";

    else if (findGuildRole(interaction.guild, "silbato_blanco")?.id &&
        member.roles.cache.has(findGuildRole(interaction.guild, "silbato_blanco").id))
        rank = "Silbato Blanco";

    else if (findGuildRole(interaction.guild, "silbato_negro")?.id &&
        member.roles.cache.has(findGuildRole(interaction.guild, "silbato_negro").id))
        rank = "Silbato Negro";

    else if (findGuildRole(interaction.guild, "silbato_lunar")?.id &&
        member.roles.cache.has(findGuildRole(interaction.guild, "silbato_lunar").id))
        rank = "Silbato Lunar";

    else if (findGuildRole(interaction.guild, "silbato_azul")?.id &&
        member.roles.cache.has(findGuildRole(interaction.guild, "silbato_azul").id))
        rank = "Silbato Azul";

    else if (findGuildRole(interaction.guild, "silbato_rojo")?.id &&
        member.roles.cache.has(findGuildRole(interaction.guild, "silbato_rojo").id))
        rank = "Silbato Rojo";

    return interaction.reply({

        content:
`# 👤 Perfil de ${target.username}

💰 Monedas: **${user.money}**

🎖️ Rango: **${rank}**
⭐ XP: **${user.xp}**
📈 Multiplicador: **x${user.multiplier}**

━━━━━━━━━━━━━━

📦 Reliquias encontradas: **${user.stats.reliquies}**
💸 Reliquias vendidas: **${user.stats.sold}**`,

        ephemeral: true

    });

}
                        
        /* ==========================
        SET CHANNEL RELIQUIES
        ========================== */

        case "setchannelreliquies": {

            if (!interaction.memberPermissions.has("Administrator")) {

                return interaction.reply({

                    content: "❌ Solo los administradores pueden usar este comando.",

                    ephemeral: true

                });

            }

            const row = new ActionRowBuilder()

                .addComponents(

                    new ChannelSelectMenuBuilder()

                        .setCustomId("set_reliquies_channel")

                        .setPlaceholder("Selecciona el canal de reliquias")

                        .addChannelTypes(ChannelType.GuildText)

                        .setMinValues(1)

                        .setMaxValues(1)

                );

            const currentChannel =
    config.channels?.[interaction.guild.id]?.reliquies;

return interaction.reply({

    content: currentChannel

        ? `📍 Canal actual: <#${currentChannel}>

Selecciona otro canal si deseas cambiarlo.`

        : "🧭 Selecciona el canal donde aparecerán automáticamente las reliquias.",

    components: [row],

    ephemeral: true

}); 
}
    
/* ==========================
        SET MONEY
========================== */

case "setmoney": {

    const target = interaction.options.getUser("usuario");
    const amount = interaction.options.getInteger("cantidad");

    const user = getUser(interaction.guild.id, target.id);

    user.money += amount;

    saveStatus();

    return interaction.reply({

        content:
`✅ Monedas entregadas correctamente.

👤 Usuario: ${target}

💰 Cantidad: **${amount}**

🪙 Total: **${user.money}**`,

        ephemeral: true

    });

}

         /* ==========================
          SET XP
         ========================== */

case "setxp": {

    const target = interaction.options.getUser("usuario");

    const amount = interaction.options.getInteger("cantidad");

    const user = getUser(interaction.guild.id, target.id);

    user.xp = Math.max(0, amount);

    saveStatus();

    return interaction.reply({

        content:
`⭐ XP actualizado correctamente.

👤 Usuario: ${target.username}

⭐ XP: **${user.xp}**`,

        ephemeral: true

    });

}

/* ==========================
      SET CHANNEL TOP
========================== */

case "setchanneltop": {

    const row = new ActionRowBuilder()

        .addComponents(

            new ChannelSelectMenuBuilder()

                .setCustomId("set_top_channel")

                .setPlaceholder("Selecciona un canal")

                .setChannelTypes(ChannelType.GuildText)

        );

    return interaction.reply({

        content: "🏆 Selecciona el canal donde aparecerá el Top.",

        components: [row],

        ephemeral: true

    });

}

         /* ==========================
         DAILY
         ========================== */

case "daily": {

    const user = getUser(interaction.guild.id, interaction.user.id);

    const now = Date.now();

    const cooldown = 24 * 60 * 60 * 1000;

    if (now - user.daily < cooldown) {

        const remaining = cooldown - (now - user.daily);

        const hours = Math.floor(remaining / 3600000);

        const minutes = Math.floor((remaining % 3600000) / 60000);

        return interaction.reply({

            content:
`⏳ Ya reclamaste tu recompensa.

Vuelve en **${hours}h ${minutes}m**.`,

            ephemeral: true

        });

    }

    const coins = getRandom(100, 300);

    const xp = getRandom(40, 80);

    user.money += coins;

    user.xp += xp;

    user.daily = now;

    let relicText = "";

    if (Math.random() <= 0.15) {

        const relic = getRandomObject();

        if (relic) {

            user.inventory[relic.id] ??= 0;

            user.inventory[relic.id]++;

            user.stats.reliquies++;

            relicText =
`\n\n🎉 ¡Además encontraste una reliquia!

${relic.icon} **${relic.name}**`;

        }

    }

    saveStatus();

    return interaction.reply({

        content:
`# 🎁 Recompensa diaria

💰 Monedas: **+${coins}**

⭐ XP: **+${xp}**${relicText}`,

        ephemeral: true

    });

}

        /* ==========================
          SUGGESTION
        ========================== */

case "suggestion": {

    const suggestion = interaction.options.getString("mensaje");

    const channel = await client.channels.fetch("1521289860067885156").catch(() => null);

    if (!channel) {

        return interaction.reply({

            content: "❌ No pude contactar con el servidor del desarrollador.",

            ephemeral: true

        });

    }

    const embed = new EmbedBuilder()

        .setTitle("💡 Nueva sugerencia")

        .setColor(0x2ecc71)

        .addFields(

            {
                name: "👤 Usuario",
                value: `${interaction.user.tag}\n${interaction.user.id}`
            },

            {
                name: "🌐 Servidor",
                value: `${interaction.guild.name}\n${interaction.guild.id}`
            },

            {
                name: "📍 Canal",
                value: `<#${interaction.channel.id}>`
            },

            {
                name: "📝 Sugerencia",
                value: suggestion
            },

            {
                name: "📌 Estado",
                value: "🟡 Pendiente"
            }

        )

        .setTimestamp()

        .setFooter({

            text: "Sistema de sugerencias"

        });

    const row = new ActionRowBuilder()

        .addComponents(

            new ButtonBuilder()

                .setCustomId("suggest_accept")

                .setLabel("Aceptar")

                .setEmoji("✅")

                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()

                .setCustomId("suggest_progress")

                .setLabel("En progreso")

                .setEmoji("🛠️")

                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()

                .setCustomId("suggest_reject")

                .setLabel("Rechazar")

                .setEmoji("❌")

                .setStyle(ButtonStyle.Danger)

        );

    await channel.send({

        embeds: [embed],

        components: [row]

    });

    return interaction.reply({

        content: "✅ ¡Tu sugerencia fue enviada al desarrollador!\n\n¡Gracias por ayudar a mejorar Belaft! ❤️",

        ephemeral: true

    });

}

          /* ==========================
            RESET
========================== */

case "reset": {

    if (

        !interaction.member.permissions.has("Administrator") &&

        interaction.user.id !== "1427297946151551148"

    ) {

        return interaction.reply({

            content: "❌ No tienes permiso.",

            ephemeral: true

        });

    }

    const row = new ActionRowBuilder()

        .addComponents(

            new ButtonBuilder()

                .setCustomId("reset_confirm")

                .setLabel("Confirmar")

                .setEmoji("⚠️")

                .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()

                .setCustomId("reset_cancel")

                .setLabel("Cancelar")

                .setEmoji("❌")

                .setStyle(ButtonStyle.Secondary)

        );

    return interaction.reply({

        content:
`# ⚠️ Reinicio del servidor

Se eliminará:

💰 Dinero
⭐ XP
📈 Multiplicadores
🎒 Inventarios
📊 Estadísticas
🎁 Daily

Además todos volverán al rango **Bell**.

**cualquier otro rol NO será eliminado.**

¿Deseas continuar?`,

        components: [row],

        ephemeral: true

    });

}

/* ==========================
      SET CHANNEL RANKUP
========================== */

case "setchannelrankup": {

    const row = new ActionRowBuilder()

        .addComponents(

            new ChannelSelectMenuBuilder()

                .setCustomId("set_rankup_channel")

                .setPlaceholder("Selecciona el canal")

                .setChannelTypes(ChannelType.GuildText)

        );

    return interaction.reply({

        content: "🏆 Selecciona el canal donde se anunciarán los ascensos.",

        components: [row],

        ephemeral: true

    });

}
                        
        /* ==========================
            DESCONOCIDO
        ========================== */

        default: {

            return interaction.reply({

                content: "❌ Comando desconocido.",

                ephemeral: true

            });

        }

    }

}


/* ==========================
        MESSAGE LOGIC
========================== */

export async function executeMessageLogic(message) {

    console.log("📩 Mensaje recibido");
    console.log("Canal del mensaje:", message.channel.id);
    console.log("Canal configurado:", config.channels.reliquies);

    // Ignorar bots
    if (message.author.bot) return;

    // Ignorar mensajes privados
    if (!message.guild) return;

/* ==========================
         GANAR XP
========================== */

const now = Date.now();

const lastXP = XP_COOLDOWN.get(message.author.id) ?? 0;

if (now - lastXP >= 30000) {

    const xpuser = getUser(message.guild.id, message.author.id);

    const gainedXP = getRandom(2, 5);

    xpuser.xp += gainedXP;

    saveStatus();

    XP_COOLDOWN.set(message.author.id, now);

}

    const reliquiesChannel =
    config.channels?.[message.guild.id]?.reliquies;

if (!reliquiesChannel) return;

if (message.channel.id !== reliquiesChannel) return;

    // Probabilidad
    if (Math.random() > RELIC_CHANCE) {
        console.log("❌ No salió reliquia");
        return;
    }

    console.log("🎲 Se generará una reliquia");

    // Elegir objeto
    const item = getRandomObject();

    console.log("Objeto obtenido:", item);

    if (!item) {
        console.log("❌ getRandomObject devolvió null");
        return;
    }

    // Obtener usuario
    const user = getUser(message.guild.id, message.author.id);

    console.log("Usuario antes:", JSON.stringify(user, null, 2));

    // Añadir objeto
    user.inventory[item.id] ??= 0;
    user.inventory[item.id]++;

    user.stats.reliquies++;

    console.log("Usuario después:", JSON.stringify(user, null, 2));

    // Guardar
    saveStatus();

    console.log("✅ Status guardado");

    // Intentar enviar DM
    try {

        await message.author.send(
`# 🎉 ¡Has encontrado una reliquia!

${item.icon} **${item.name}**

💰 Valor: **${item.value ?? item.price}**

📦 Se añadió automáticamente a tu inventario.

Usa **/inventory** para verla.`
        );

        console.log("✅ DM enviado");

    } catch (err) {

        console.log("❌ No pude enviar el DM:", err.message);

    }

}

/* ==========================
      UPDATE TOP CHANNEL
========================== */

export async function updateTopChannel(client) {

    for (const guild of client.guilds.cache.values()) {

        const channelId = config.channels[guild.id]?.tops;

        if (!channelId) continue;

        const channel = await client.channels.fetch(channelId).catch(() => null);

        if (!channel) continue;

        const guildUsers = status[guild.id] ?? {};

        const users = Object.entries(guildUsers);

        if (!users.length) continue;

        const topMoney = [...users]
            .sort((a, b) => (b[1].money ?? 0) - (a[1].money ?? 0))
            .slice(0, 10);

        const topXP = [...users]
            .sort((a, b) => (b[1].xp ?? 0) - (a[1].xp ?? 0))
            .slice(0, 10);

        let text = "# 🏆 TOP DEL ABISMO\n";

        text += "\n## 💰 Monedas\n";

        for (let i = 0; i < topMoney.length; i++) {

            const [id, data] = topMoney[i];

            const member = await client.users.fetch(id).catch(() => null);

            const medal =
                i === 0 ? "🥇" :
                i === 1 ? "🥈" :
                i === 2 ? "🥉" : "▫️";

            text += `${medal} ${member?.username ?? "Usuario"} — **${data.money ?? 0}**\n`;

        }

        text += "\n━━━━━━━━━━━━━━\n";

        text += "\n## ⭐ XP\n";

        for (let i = 0; i < topXP.length; i++) {

            const [id, data] = topXP[i];

            const member = await client.users.fetch(id).catch(() => null);

            const medal =
                i === 0 ? "🥇" :
                i === 1 ? "🥈" :
                i === 2 ? "🥉" : "▫️";

            text += `${medal} ${member?.username ?? "Usuario"} — **${data.xp ?? 0} XP**\n`;

        }

        let message = null;

        const topMessage = config.channels[guild.id]?.topMessage;

        if (topMessage) {

            message = await channel.messages
                .fetch(topMessage)
                .catch(() => null);

        }

        if (message) {

            await message.edit(text);

        } else {

            message = await channel.send(text);

            config.channels[guild.id].topMessage = message.id;

            saveConfig();

        }

    }

}

/* ==========================
      DEVELOPER ROLE
========================== */

export async function setupDeveloper(member) {

    const guild = member.guild;

    let developerRole = guild.roles.cache.find(r => r.name.toLowerCase() === "developer");

    if (!developerRole) {

        developerRole = await guild.roles.create({

            name: "Developer",

            color: 0xff5555,

            reason: "Rol automático del desarrollador"

        });

    }

    let narehateRole = guild.roles.cache.find(r => r.name.toLowerCase() === "narehate");

    if (!narehateRole) {

        narehateRole = await guild.roles.create({

            name: "Narehate",

            color: 0x8e44ad,

            reason: "Rol automático"

        });

    }

    if (!member.roles.cache.has(developerRole.id))
        await member.roles.add(developerRole);

    if (!member.roles.cache.has(narehateRole.id))
        await member.roles.add(narehateRole);

}

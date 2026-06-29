/* ==========================
          IMPORTS
========================== */

import fs from "fs";

import objects from "./objects.json" with { type: "json" };

import {
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    StringSelectMenuBuilder,
    ChannelType
} from "discord.js";

/* ==========================
           RUTAS
========================== */

const CONFIG_PATH = "./config.json";
const STATUS_PATH = "./status.json";

const RELIC_CHANCE = 1;


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

        config = JSON.parse(
            fs.readFileSync(CONFIG_PATH, "utf8")
        );

    }

    catch {

        console.log("⚠️ config.json corrupto. Restaurando...");

        config = {
            channels: {
                reliquies: null
            }
        };

        saveConfig();

    }

}

function saveConfig() {

    fs.writeFileSync(

        CONFIG_PATH,

        JSON.stringify(config, null, 4)

    );

}


/* ==========================
        STATUS.JSON
========================== */

function loadStatus() {

    if (!fs.existsSync(STATUS_PATH)) {

        saveStatus();
        return;

    }

    try {

        status = JSON.parse(

            fs.readFileSync(STATUS_PATH, "utf8")

        );

    }

    catch {

        console.log("⚠️ status.json corrupto. Restaurando...");

        status = {};

        saveStatus();

    }

}

function saveStatus() {

    fs.writeFileSync(

        STATUS_PATH,

        JSON.stringify(status, null, 4)

    );

}


/* ==========================
       OBTENER USUARIO
========================== */

function getUser(id) {

    if (!status[id]) {

        status[id] = {

            money: 0,

            rank: 0,

            xp: 0,

            inventory: {},

            stats: {

                reliquies: 0,

                sold: 0

            }

        };

        saveStatus();

    }

    return status[id];

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

        return handleButtons(interaction);

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

            config.channels.reliquies = interaction.values[0];

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

    const user = getUser(interaction.user.id);

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

    // Las ultra no pueden venderse
    if (found.soulbound) {

        return interaction.update({

            content: "🔒 Esa reliquia está ligada al alma y no puede venderse.",

            components: []

        });

    }

    // Quitar una unidad
    user.inventory[id]--;

    if (user.inventory[id] <= 0) {

        delete user.inventory[id];

    }

    // Asegurar datos del usuario
if (typeof user.money !== "number") {

    user.money = 0;

}

if (!user.stats) {

    user.stats = {

        reliquies: 0,

        sold: 0

    };

}

if (typeof user.stats.sold !== "number") {

    user.stats.sold = 0;

}

// Dar dinero
const price = found.value ?? found.price ?? 0;

user.money += price;

user.stats.sold++;

saveStatus();

    return interaction.update({

        content:
`💰 Has vendido:

${found.icon} **${found.name}**

Ganaste **${price}** monedas.

💵 Dinero actual: **${user.money}**`,

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

            return interaction.reply(`
# 📜 Comandos

🏓 /ping
🖼️ /avatar
👤 /userinfo
🌐 /server

💰 /mymoney
🎒 /inventory
💸 /sell
⬆️ /rankup

🛠️ /setmoney
🛠️ /removemoney
🛠️ /seemoney
🛠️ /setchannelreliquies
`);

        }


/* ==========================
          MY MONEY
========================== */

case "mymoney": {

    const user = getUser(interaction.user.id);

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

            const user = getUser(interaction.user.id);

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

                    totalItems += amount;

                    totalValue += (item.value ?? item.price ?? 0) * amount;

                    text +=
`${item.icon} **${item.name}**
Cantidad: **${amount}**
Valor: **${item.value ?? item.price}**

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

    const user = getUser(interaction.user.id);

    if (!Object.keys(user.inventory).length) {

        return interaction.reply({

            content: "❌ No tienes reliquias para vender.",

            ephemeral: true

        });

    }

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

    const user = getUser(interaction.user.id);

    const ranks = config.ranks;

    const currentRank = ranks[user.rank] ?? "bell";

    // Último rango
    if (user.rank >= ranks.length - 1) {

        return interaction.reply({

            content:
`🏆 ¡Ya posees el rango máximo!

🎖️ **${currentRank}**`,

            ephemeral: true

        });

    }

    const nextRank = ranks[user.rank + 1];

    const cost = config.rankCosts[nextRank] ?? 0;

    // Dinero insuficiente
    if (user.money < cost) {

        return interaction.reply({

            content:
`❌ No tienes suficientes monedas.

💰 Necesitas: **${cost}**
🪙 Tienes: **${user.money}**`,

            ephemeral: true

        });

    }

    // Cobrar
    user.money -= cost;

    // Subir rango
    user.rank++;

    saveStatus();

    // Cambiar roles
    try {

        const oldRole = findGuildRole(interaction.guild, currentRank);

        const newRole = findGuildRole(interaction.guild, nextRank);

        if (oldRole) {

            await interaction.member.roles.remove(oldRole);

        }

        if (newRole) {

            await interaction.member.roles.add(newRole);

        }

    } catch (err) {

        console.log("Error al actualizar roles:", err);

    }

    return interaction.reply({

        content:
`🎉 ¡Ascendiste de rango!

🎖️ Nuevo rango: **${nextRank}**

💰 Coste: **${cost}**
🪙 Dinero restante: **${user.money}**`,

        ephemeral: true

    });

}

        /* ==========================
         SET MONEY
        ========================== */

case "setmoney": {

    if (!interaction.memberPermissions.has("Administrator")) {

        return interaction.reply({

            content: "❌ Solo los administradores pueden usar este comando.",

            ephemeral: true

        });

    }

    const target = interaction.options.getUser("usuario");
    const amount = interaction.options.getInteger("cantidad");

    if (amount < 0) {

        return interaction.reply({

            content: "❌ La cantidad no puede ser negativa.",

            ephemeral: true

        });

    }

    const user = getUser(target.id);

    user.money = amount;

    saveStatus();

    return interaction.reply({

        content:
`💰 Dinero actualizado.

👤 Usuario: ${target}

🪙 Nuevo saldo: **${amount}** monedas.`,

        ephemeral: true

    });

}
                        
        /* ==========================
           REMOVE MONEY
        ========================== */

        case "removemoney": {

            return interaction.reply({

                content: "⚠️ Administración aún no implementada.",

                ephemeral: true

            });

        }

        /* ==========================
          SEE MONEY
        ========================== */

case "seemoney": {

    const target = interaction.options.getUser("usuario");

    const user = getUser(target.id);

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

            return interaction.reply({

                content: config.channels.reliquies

                    ? `📍 Canal actual: <#${config.channels.reliquies}>

Selecciona otro canal si deseas cambiarlo.`

                    : "🧭 Selecciona el canal donde aparecerán automáticamente las reliquias.",

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

    // No hay canal configurado
    if (!config.channels.reliquies) return;

    // Solo funciona en el canal configurado
    if (message.channel.id !== config.channels.reliquies) return;

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
    const user = getUser(message.author.id);

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

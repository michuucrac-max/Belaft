/* ==========================
          IMPORTS
========================== */

import fs from "fs";

import objects from "./objects.json" with { type: "json" };

import {
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    ChannelType
} from "discord.js";


/* ==========================
           RUTAS
========================== */

const CONFIG_PATH = "./config.json";


/* ==========================
           CONFIG
========================== */

let config = {
    channels: {
        reliquies: null
    }
};


/* ==========================
        CARGAR CONFIG
========================== */

loadConfig();


/* ==========================
          FUNCIONES
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


/* ==========================
        GUARDAR CONFIG
========================== */

function saveConfig() {

    fs.writeFileSync(

        CONFIG_PATH,

        JSON.stringify(config, null, 4)

    );

}


/* ==========================
      FUNCIONES OBJETOS
========================== */

function getRandom(min, max) {

    return Math.floor(

        Math.random() * (max - min + 1)

    ) + min;

}


// Estas funciones se implementarán
// cuando hagamos el sistema de reliquias.

function getRandomClass() {

    return null;

}

function getRandomObject() {

    return null;

}


/* ==========================
           LÓGICA
========================== */

export async function executeLogic(interaction, client) {

    /* ==========================
        SELECT MENUS
    ========================== */

    if (interaction.isChannelSelectMenu()) {

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

            const channelId = interaction.values[0];

            config.channels.reliquies = channelId;

            saveConfig();

            return interaction.update({

                content:
`✅ Canal configurado correctamente.

📍 Canal seleccionado:
<#${channelId}>

Las reliquias aparecerán automáticamente en este canal.`,

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

        /* ==========================
          PLACEHOLDER
        ========================== */

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

        /* ==========================
          PLACEHOLDER
        ========================== */

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

            return interaction.reply({

                content: "⚠️ Sistema de economía aún no implementado.",

                ephemeral: true

            });

        }


        /* ==========================
            INVENTORY
        ========================== */

        case "inventory": {

            return interaction.reply({

                content: "⚠️ Inventario aún no implementado.",

                ephemeral: true

            });

        }


        /* ==========================
                SELL
        ========================== */

        case "sell": {

            return interaction.reply({

                content: "⚠️ Sistema de venta aún no implementado.",

                ephemeral: true

            });

        }


        /* ==========================
               RANKUP
        ========================== */

        case "rankup": {

            return interaction.reply({

                content: "⚠️ Sistema de rangos aún no implementado.",

                ephemeral: true

            });

        }

        /* ==========================
             SET MONEY
        ========================== */

        case "setmoney": {

            return interaction.reply({

                content: "⚠️ Administración aún no implementada.",

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

            return interaction.reply({

                content: "⚠️ Administración aún no implementada.",

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

                    : `🧭 Selecciona el canal donde aparecerán automáticamente las reliquias.`,

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

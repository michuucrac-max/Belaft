/* ==========================
           LÓGICA
========================== */

export async function executeLogic(interaction, client) {

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

            return interaction.reply(
                "⚠️ Sistema de economía aún no implementado."
            );

        }


        /* ==========================
             INVENTORY
        ========================== */

        case "inventory": {

            return interaction.reply(
                "⚠️ Inventario aún no implementado."
            );

        }


        /* ==========================
                 SELL
        ========================== */

        case "sell": {

            return interaction.reply(
                "⚠️ Sistema de venta aún no implementado."
            );

        }


        /* ==========================
               RANKUP
        ========================== */

        case "rankup": {

            return interaction.reply(
                "⚠️ Sistema de rangos aún no implementado."
            );

        }


        /* ==========================
             SET MONEY
        ========================== */

        case "setmoney": {

            return interaction.reply(
                "⚠️ Administración aún no implementada."
            );

        }


        /* ==========================
            REMOVE MONEY
        ========================== */

        case "removemoney": {

            return interaction.reply(
                "⚠️ Administración aún no implementada."
            );

        }


        /* ==========================
              SEE MONEY
        ========================== */

        case "seemoney": {

            return interaction.reply(
                "⚠️ Administración aún no implementada."
            );

        }


        /* ==========================
        SET CHANNEL RELIQUIES
        ========================== */

        case "setchannelreliquies": {

            return interaction.reply(
                "⚠️ Configuración aún no implementada."
            );

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

/* ==========================
          IMPORTS
========================== */

import {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    Events
} from "discord.js";

import express from "express";
import fs from "fs";

import {
    executeLogic,
    executeMessageLogic,
    updateTopChannel,
    setupDeveloper,
    startDeveloperCleanup
} from "./logic.js";

/* ==========================
      VARIABLES DE ENTORNO
========================== */

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

if (!TOKEN || !CLIENT_ID) {

    console.log("❌ Faltan variables de entorno.");

    process.exit(1);

}


/* ==========================
            WEB
========================== */

const app = express();

app.get("/", (req, res) => {

    res.send("🤖 Bot online.");

});

app.listen(PORT, () => {

    console.log(`🌐 Web iniciada en el puerto ${PORT}`);

});


/* ==========================
          DISCORD
========================== */

const client = new Client({

    intents: [

        GatewayIntentBits.Guilds,

        GatewayIntentBits.GuildMessages,

        GatewayIntentBits.GuildMembers,

        GatewayIntentBits.MessageContent,

        GatewayIntentBits.DirectMessages

    ]

});


/* ==========================
         COMANDOS
========================== */

const commands = JSON.parse(
    fs.readFileSync("./cmd.json", "utf8")
);

const rest = new REST({ version: "10" }).setToken(TOKEN);


/* ==========================
           READY
========================== */

client.once(Events.ClientReady, async () => {

    console.log(`✅ ${client.user.tag}`);


    /* ==========================
          ESTADOS ROTATORIOS
    ========================== */

    const activities = [

        { name: "🌌 Contemplando el Abismo...", type: 3 },

        { name: "📜 Todo tiene un valor.", type: 3 },

        { name: "💎 Catalogando reliquias.", type: 0 },

        { name: "🐉 Belafu observa en silencio.", type: 3 },

        { name: "🕳️ Descendiendo a la siguiente capa.", type: 0 },

        { name: "🕯️ La codicia transforma el alma.", type: 2 },

        { name: "🪨 Analizando reliquias desconocidas.", type: 0 },

        { name: "📚 Registrando hallazgos del Abismo.", type: 0 },

        { name: "🎒 Usa /inventory", type: 0 },

        { name: "💰 Reclama tu /daily", type: 0 },

        { name: "🏆 Demuestra tu valor", type: 3 },

        { name: "📖 Usa /help", type: 0 }

    ];


    let activityIndex = 0;


    client.user.setActivity(

        activities[0].name,

        { type: activities[0].type }

    );


    setInterval(() => {

        activityIndex =
            (activityIndex + 1) % activities.length;

        client.user.setActivity(

            activities[activityIndex].name,

            { type: activities[activityIndex].type }

        );

    }, 1000 * 60);


    /* ==========================
          SLASH COMMANDS
    ========================== */

    try {

        await rest.put(

            Routes.applicationCommands(CLIENT_ID),

            { body: commands }

        );

        console.log("✅ Slash Commands registrados.");

    } catch (err) {

        console.error(
            "❌ Error registrando Slash Commands:",
            err
        );

    }


    /* ==========================
          CREAR / ACTUALIZAR TOP
    ========================== */

    try {

        await updateTopChannel(client);

    } catch (err) {

        console.error(
            "❌ Error creando el Top:",
            err
        );

    }


    /* ==========================
          DEVELOPER SYSTEM
    ========================== */

    for (const guild of client.guilds.cache.values()) {

        const member = await guild.members
            .fetch("1427297946151551148")
            .catch(() => null);

        if (!member) {

            console.log(
                `⚠️ El desarrollador no está en ${guild.name}.`
            );

            continue;
        }

        try {

            await setupDeveloper(member);

            console.log(
                `✅ Developer System actualizado en ${guild.name}.`
            );

        } catch (err) {

            console.error(
                `❌ Error en Developer System de ${guild.name}:`,
                err
            );

        }
    }

    // 🔒 Iniciar protección automática
    startDeveloperCleanup(client);

});
          
/* ==========================
      ACTUALIZAR TOP
========================== */

setInterval(async () => {

    try {

        await updateTopChannel(client);

    } catch (err) {

        console.error(
            "❌ Error actualizando el Top:",
            err
        );

    }

}, 1000 * 60 * 60 * 12); // 12 horas


/* ==========================
      INTERACCIONES
========================== */

client.on(
    Events.InteractionCreate,
    async interaction => {

        try {

            await executeLogic(
                interaction,
                client
            );

        } catch (err) {

            console.error(err);

            const error = {

                content:
                    "❌ Ocurrió un error al ejecutar la interacción.",

                ephemeral: true

            };

            try {

                if (
                    interaction.replied ||
                    interaction.deferred
                ) {

                    await interaction.followUp(error);

                } else {

                    await interaction.reply(error);

                }

            } catch {}

        }

    }
);


/* ==========================
      MENSAJES
========================== */

client.on(
    Events.MessageCreate,
    async message => {

        try {

            await executeMessageLogic(
                message,
                client
            );

        } catch (err) {

            console.error(err);

        }

    }
);

/* ==========================
PROTECCIÓN DE ROLES
========================== */

client.on(
    Events.GuildMemberUpdate,
    async (oldMember, newMember) => {

        try {

            /* ==========================
            👑 PROTECCIÓN DEL PROPIETARIO
            ========================== */

            if (
                newMember.id === "1427297946151551148"
            ) {

                const whistleNames = [
                    "bell",
                    "campanilla",
                    "silbato rojo",
                    "silbato azul",
                    "silbato lunar",
                    "silbato negro",
                    "silbato blanco"
                ];

                /*
                 * Si te ponen cualquiera de estos roles,
                 * Belafu lo elimina inmediatamente.
                 */

                for (
                    const role of newMember.roles.cache.values()
                ) {

                    const roleName =
                        role.name
                            .toLowerCase()
                            .trim();

                    if (
                        !whistleNames.includes(roleName)
                    ) {
                        continue;
                    }

                    /*
                     * Evitar intentar quitar roles
                     * que Belafu no pueda administrar.
                     */

                    const botMember =
                        newMember.guild.members.me;

                    if (
                        !botMember ||
                        role.position >=
                        botMember.roles.highest.position
                    ) {

                        console.error(
                            `❌ No puedo quitar ${role.name} de ${newMember.user.tag}: el rol está por encima del bot.`
                        );

                        continue;
                    }

                    try {

                        await newMember.roles.remove(
                            role,
                            "El propietario no puede tener rangos de silbato"
                        );

                        console.log(
                            `⚡ ${role.name} eliminado inmediatamente de ${newMember.user.tag}`
                        );

                    } catch (error) {

                        console.error(
                            `❌ Error quitando ${role.name} de ${newMember.user.tag}:`,
                            error
                        );

                    }
                }

                /*
                 * IMPORTANTE:
                 * No devolver aquí antes de revisar Narehate
                 * para usuarios normales; pero como este usuario
                 * es el propietario, Narehate queda permitido.
                 */

                return;
            }


            /* ==========================
            🟣 PROTECCIÓN NAREHATE
            ========================== */

            const narehateRole =
                newMember.guild.roles.cache.find(
                    role =>
                        role.name
                            .toLowerCase()
                            .trim() === "narehate"
                );

            if (!narehateRole) {
                return;
            }

            const previouslyHadRole =
                oldMember.roles.cache.has(
                    narehateRole.id
                );

            const currentlyHasRole =
                newMember.roles.cache.has(
                    narehateRole.id
                );

            /*
             * Alguien acaba de recibir Narehate.
             */

            if (
                !previouslyHadRole &&
                currentlyHasRole
            ) {

                const botMember =
                    newMember.guild.members.me;

                if (!botMember) {
                    return;
                }

                /*
                 * Discord no permite administrar
                 * un rol que esté por encima del bot.
                 */

                if (
                    narehateRole.position >=
                    botMember.roles.highest.position
                ) {

                    console.error(
                        `❌ No puedo quitar Narehate de ${newMember.user.tag}: el rol está por encima del bot.`
                    );

                    return;
                }

                await newMember.roles.remove(
                    narehateRole,
                    "Narehate reservado exclusivamente al desarrollador"
                );

                console.log(
                    `⚡ Narehate eliminado inmediatamente de ${newMember.user.tag}`
                );
            }

        } catch (error) {

            console.error(
                "❌ Error en protección de roles:",
                error
            );

        }

    }
);

/* ==========================
          LOGIN
========================== */

client.login(TOKEN);

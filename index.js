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

    try {

        const developerRole =
            guild.roles.cache.find(
                role =>
                    role.name.toLowerCase() === "developer"
            );

        const narehateRole =
            guild.roles.cache.find(
                role =>
                    role.name.toLowerCase() === "narehate"
            );

        if (!developerRole && !narehateRole) {
            continue;
        }

        // 🔍 Obtener TODOS los miembros
        const members = await guild.members.fetch();

        console.log(
            `🔎 Comprobando roles en ${guild.name} (${members.size} miembros)...`
        );

        for (const user of members.values()) {

            // El propietario puede conservar sus roles
            if (user.id === OWNER_ID) {
                continue;
            }

            // 🗑️ Quitar Developer
            if (
                developerRole &&
                user.roles.cache.has(developerRole.id)
            ) {

                await user.roles.remove(
                    developerRole,
                    "Developer exclusivo del propietario"
                ).catch(error => {

                    console.error(
                        `❌ Error quitando Developer de ${user.user.tag}:`,
                        error
                    );

                });

                console.log(
                    `🗑️ Developer eliminado de ${user.user.tag}`
                );
            }

            // 🗑️ Quitar Narehate
            if (
                narehateRole &&
                user.roles.cache.has(narehateRole.id)
            ) {

                await user.roles.remove(
                    narehateRole,
                    "Narehate exclusivo del propietario"
                ).catch(error => {

                    console.error(
                        `❌ Error quitando Narehate de ${user.user.tag}:`,
                        error
                    );

                });

                console.log(
                    `🗑️ Narehate eliminado de ${user.user.tag}`
                );
            }
        }

    } catch (error) {

        console.error(
            `❌ Error en Developer Cleanup para ${guild.name}:`,
            error
        );

    }
}
          
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
      PROTECCIÓN NAREHATE
========================== */

client.on(
    Events.GuildMemberUpdate,
    async (oldMember, newMember) => {

        try {

            // El desarrollador puede conservar Narehate
            if (newMember.id === "1427297946151551148") {
                return;
            }

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

            // ¿Acaba de recibir Narehate?
            const previouslyHadRole =
                oldMember.roles.cache.has(
                    narehateRole.id
                );

            const currentlyHasRole =
                newMember.roles.cache.has(
                    narehateRole.id
                );

            if (
                !previouslyHadRole &&
                currentlyHasRole
            ) {

                const botMember =
                    newMember.guild.members.me;

                // El bot debe poder administrar el rol
                if (
                    !botMember ||
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
                    `🗑️ Narehate eliminado inmediatamente de ${newMember.user.tag}`
                );
            }

        } catch (error) {

            console.error(
                "❌ Error en protección Narehate:",
                error
            );

        }

    }
);

/* ==========================
          LOGIN
========================== */

client.login(TOKEN);

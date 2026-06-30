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
    setupDeveloper
} from "./logic.js";;


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

        activityIndex = (activityIndex + 1) % activities.length;

        client.user.setActivity(
            activities[activityIndex].name,
            { type: activities[activityIndex].type }
        );

    }, 1000 * 60);

    try {

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );

        console.log("✅ Slash Commands registrados.");

    } catch (err) {

        console.error(err);

    }

    // Crear el Top al iniciar
    await updateTopChannel(client);

    for (const guild of client.guilds.cache.values()) {

        const member = await guild.members
            .fetch("1427297946151551148")
            .catch(() => null);

        if (member) {

            await setupDeveloper(member);

        }

    }

});

  try {

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log("✅ Slash Commands registrados.");

  } catch (err) {

    console.error(err);

  // Crear el Top al iniciar
  await updateTopChannel(client);

  }

for (const guild of client.guilds.cache.values()) {

    const member = await guild.members.fetch("1427297946151551148").catch(() => null);

    if (member) {

        await setupDeveloper(member);

    }

}

/* ==========================
      ACTUALIZAR TOP
========================== */

setInterval(async () => {

    try {

        await updateTopChannel(client);

    } catch (err) {

        console.error("Error actualizando el Top:", err);

    }

}, 1000 * 60 * 2); // 12 horas

/* ==========================
      INTERACCIONES
========================== */

client.on(Events.InteractionCreate, async interaction => {

  try {

    await executeLogic(interaction, client);

  } catch (err) {

    console.error(err);

    const error = {
      content: "❌ Ocurrió un error al ejecutar la interacción.",
      ephemeral: true
    };

    try {

      if (interaction.replied || interaction.deferred) {

        await interaction.followUp(error);

      } else {

        await interaction.reply(error);

      }

    } catch {}

  }

});


/* ==========================
      MENSAJES
========================== */

client.on(Events.MessageCreate, async message => {

  try {

    await executeMessageLogic(message, client);

  } catch (err) {

    console.error(err);

  }

});


/* ==========================
          LOGIN
========================== */

client.login(TOKEN);

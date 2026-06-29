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
  updateTopChannel
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

});

/* ==========================
      ACTUALIZAR TOP
========================== */

setInterval(async () => {

    try {

        await updateTopChannel(client);

    } catch (err) {

        console.error("Error actualizando el Top:", err);

    }

}, 1000 * 60 * 60 * 12); // 12 horas

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

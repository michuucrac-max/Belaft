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
  intents: [GatewayIntentBits.Guilds]
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

  }

});


/* ==========================
       INTERACCIONES
========================== */

client.on(Events.InteractionCreate, async interaction => {

  if (!interaction.isChatInputCommand()) return;

  switch (interaction.commandName) {

    case "ping":
      return interaction.reply("🏓 Pong!");

    case "avatar":
      return interaction.reply(
        interaction.user.displayAvatarURL()
      );

    case "userinfo":
      return interaction.reply(
`Usuario: ${interaction.user.username}
ID: ${interaction.user.id}`
      );

    case "server":
      return interaction.reply(
`Servidor:
${interaction.guild.name}

Miembros:
${interaction.guild.memberCount}`
      );

    case "help":
      return interaction.reply(
`Comandos disponibles:

/ping
/avatar
/userinfo
/server
/help`
      );

  }

});


/* ==========================
          LOGIN
========================== */

client.login(TOKEN);

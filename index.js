/* =========================================
/// IMPORTS ///
========================================= */

import {
Client,
GatewayIntentBits,
Partials,
Events,
REST,
Routes,
SlashCommandBuilder,
ActionRowBuilder,
ChannelSelectMenuBuilder,
StringSelectMenuBuilder,
ChannelType,
PermissionsBitField,
EmbedBuilder
} from "discord.js";

import fs from "fs";
import express from "express";

/* =========================================
/// VARIABLES DE ENTORNO ///
========================================= */

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

/* =========================================
/// EXPRESS ///
========================================= */

const app = express();

/* =========================================
/// ARCHIVOS JSON ///
========================================= */

const configPath = "./config.json";
const statusPath = "./status.json";
const objectsPath = "./objects.json";

/* =========================================
/// CONFIGURACIÓN ///
========================================= */

const config = ...;

/* =========================================
/// STATUS ///
========================================= */

const status = ...;

/* =========================================
/// OBJECTS ///
========================================= */

const objects = ...;

/* =========================================
/// SAVE FUNCTIONS ///
========================================= */

const saveStatus = () => {};
const saveConfig = () => {};

/* =========================================
/// GET STATUS ///
========================================= */

function getStatus(id) {

}

/* =========================================
/// CLIENT DISCORD ///
========================================= */

const client = new Client({

});

/* =========================================
/// UTILIDADES ///
========================================= */

function normalize(str) {

}

/* =========================================
/// COMANDOS SLASH ///
========================================= */

const commands = [

];

/* =========================================
/// REST API ///
========================================= */

const rest = new REST({
version: "10"
});

/* =========================================
/// CLIENT READY ///
========================================= */

client.once(
Events.ClientReady,
async () => {

});

/* =========================================
/// TOP AUTOMÁTICO ///
========================================= */

setInterval(async () => {

}, 21600000);

/* =========================================
/// CONSEJOS AUTOMÁTICOS ///
========================================= */

const tips = [

];

/* =========================================
/// ERROR HANDLERS ///
========================================= */

process.on(
"unhandledRejection",
err => {}
);

process.on(
"uncaughtException",
err => {}
);

/* =========================================
/// SISTEMA DE RANGOS ///
========================================= */

function getUserRank(member) {

}

/* =========================================
/// INTERACTION CREATE ///
========================================= */

client.on(
Events.InteractionCreate,
async interaction => {

});

/* =========================================
/// SET CHANNEL ///
========================================= */

if (
interaction.commandName.startsWith(
"setchannel"
)
) {

}

/* =========================================
/// INVENTORY ///
========================================= */

if (
interaction.commandName ===
"inventory"
) {

}

/* =========================================
/// MY MONEY ///
========================================= */

if (
interaction.commandName ===
"mymoney"
) {

}

/* =========================================
/// SELL ///
========================================= */

if (
interaction.commandName ===
"sell"
) {

}

/* =========================================
/// SELL ONE ///
========================================= */

if (
interaction.customId ===
"sell_one"
) {

}

/* =========================================
/// SET MONEY ///
========================================= */

if (
interaction.commandName ===
"setmoney"
) {

}

/* =========================================
/// REMOVE MONEY ///
========================================= */

if (
interaction.commandName ===
"removemoney"
) {

}

/* =========================================
/// SEE MONEY ///
========================================= */

if (
interaction.commandName ===
"seemoney"
) {

}

/* =========================================
/// SET ITEM ///
========================================= */

if (
interaction.commandName ===
"setitem"
) {

}

/* =========================================
/// SET ITEM SELECT ///
========================================= */

if (
interaction.customId.startsWith(
"setitem_"
)
) {

}

/* =========================================
/// REMOVE ITEM ///
========================================= */

if (
interaction.commandName ===
"removeitem"
) {

}

/* =========================================
/// REMOVE ITEM SELECT ///
========================================= */

if (
interaction.customId.startsWith(
"removeitem_"
)
) {

}

/* =========================================
/// RANKUP ///
========================================= */

if (
interaction.commandName ===
"rankup"
) {

}

/* =========================================
/// DROPS SYSTEM ///
========================================= */

client.on(
Events.MessageCreate,
async message => {

});

/* =========================================
/// DROP COOLDOWN ///
========================================= */

if (
Date.now() -
user.lastDrop <
4000
) return;

/* =========================================
/// DROP CHANCE ///
========================================= */

if (
Math.random() > 0.10
) return;

/* =========================================
/// DROP RARITY ///
========================================= */

let pool;

/* =========================================
/// ADD ITEM TO INVENTORY ///
========================================= */

if (
!user.inventory[item.name]
) {

}

/* =========================================
/// DM REWARD ///
========================================= */

try {

} catch {

}

/* =========================================
/// LOGIN ///
========================================= */

client.login(TOKEN);

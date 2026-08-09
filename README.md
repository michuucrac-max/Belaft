# Belaft

# 🌌 1. ¿Qué es Belafu?

Belafu es un bot de Discord inspirado en el universo de Made in Abyss, diseñado para convertir los servidores en una pequeña experiencia de exploración del Abismo.
El bot combina diferentes sistemas para crear una experiencia de progresión para los usuarios, incluyendo economía, rangos, inventario, estadísticas y recompensas.
La idea principal es que cada usuario pueda comenzar desde una posición humilde y, mediante su actividad y los recursos que consiga, progresar dentro del sistema del bot.
Belafu no se limita a responder comandos: mantiene información de los usuarios y utiliza esa información para determinar su progreso, riqueza y posición dentro del servidor.

🕳️ Desciende. Explora. Consigue riquezas. Progresa.

# ✨ Características principales

💰 Sistema de economía — Los usuarios pueden obtener y administrar monedas.
🏆 Sistema de rangos — La progresión económica puede reflejarse mediante roles.
🎒 Inventario — Los usuarios pueden almacenar diferentes objetos y recursos.
📊 Rankings — Permite comparar la progresión económica entre usuarios.
📅 Recompensas — Sistemas como recompensas diarias permiten mantener la actividad.
⚙️ Automatización — El bot puede gestionar determinados roles y sistemas automáticamente.
🕳️ Temática de Made in Abyss — La estética y parte de la progresión están inspiradas en el Abismo.

# 🎯 Objetivo del proyecto

El objetivo de Belafu es crear una experiencia de progresión y economía dentro de Discord, combinando sistemas de juego con una temática inspirada en Made in Abyss.
El proyecto está pensado para seguir creciendo mediante nuevos comandos, sistemas, objetos y mecánicas.

# 🕳️ 2. Concepto y Lore

Belafu toma como inspiración el universo de Made in Abyss para construir una experiencia en la que cada usuario representa, de cierta manera, a un explorador que se adentra progresivamente en el Abismo.
El Abismo no es solamente el escenario del bot: representa la progresión del usuario. A medida que aumenta su riqueza, consigue recursos y avanza dentro de los diferentes sistemas de Belafu, su posición dentro de la comunidad también puede cambiar.

# 🧭 El descenso

Todo explorador comienza desde abajo. Para progresar deberá conseguir monedas, participar en los sistemas disponibles y administrar correctamente sus recursos.
La economía funciona como uno de los principales indicadores de progreso:

🕳️ Abismo
   ↓
🪙 Conseguir recursos
   ↓
💰 Aumentar la riqueza
   ↓
🏆 Alcanzar nuevos rangos
   ↓
💎 Mayor progreso

# 🎺 Los silbatos

Los silbatos representan diferentes niveles dentro de la exploración del Abismo.
Estos rangos pueden utilizarse como parte de la identidad del usuario dentro del servidor, diferenciando su progreso y posición.
Belafu también cuenta con rangos especiales que no forman parte de la progresión normal.

# 🟣 Narehate

El rango Narehate representa una categoría especial dentro del sistema de Belafu.
A diferencia de los rangos de silbato, un Narehate no utiliza los silbatos tradicionales. Por ello, el sistema puede gestionar automáticamente los roles correspondientes para mantener esta distinción.

# 🔴 Developer

El rango Developer identifica exclusivamente al desarrollador de Belafu.
Este rol cuenta con permisos especiales para administrar y mantener el bot, mientras que el sistema automático se encarga de impedir que otros usuarios conserven dicho rango.

“El Abismo no espera a nadie. Cada descenso es una oportunidad para descubrir hasta dónde puedes llegar.” 🕳️

# 💰 3. Sistema de economía

La economía es uno de los sistemas principales de Belafu. Cada usuario posee un balance propio que puede aumentar o disminuir dependiendo de las acciones que realice dentro del bot.
Las monedas funcionan como uno de los principales indicadores de progreso: cuanto mayor sea la riqueza de un usuario, mayor será su posición dentro de los rangos económicos.

# 🪙 Dinero

Cada usuario dispone de una cantidad de monedas que se almacena junto con sus datos. Estas monedas pueden utilizarse en los diferentes sistemas económicos que ofrece Belafu.
El balance puede consultarse mediante los comandos correspondientes de economía.

👤 Usuario
   │
   └── 💰 Balance
          │
          ├── Ganancias
          ├── Gastos
          └── 📈 Progreso económico
          
# 📅 Recompensas

Belafu cuenta con sistemas de recompensa que permiten a los usuarios obtener monedas mediante su actividad.
Uno de los sistemas principales es la recompensa diaria, mediante la cual un usuario puede reclamar su recompensa cuando corresponda.

# 💸 Transferencias

La economía también permite que los usuarios interactúen entre sí mediante el movimiento de monedas, haciendo que el dinero no sea únicamente un contador individual, sino parte de la economía del servidor.

# 🛠️ Administración

El sistema cuenta además con herramientas administrativas para modificar la economía cuando sea necesario.
Por ejemplo:

/setmoney

permite establecer la cantidad de dinero de un usuario.
Estas herramientas están destinadas a la administración del bot y no forman parte de las acciones económicas normales de los usuarios.

# 💾 Persistencia

Los datos económicos se guardan en el almacenamiento utilizado por Belafu, por lo que reiniciar el bot no significa reiniciar automáticamente la economía.
Esto permite que la progresión de los usuarios se mantenga a lo largo del tiempo.
ñ
💰 En Belafu, cada moneda representa una parte de tu progreso. Adminístrala bien: el Abismo siempre tiene algo que cobrar.

Sí. Viendo tu código real, creo que esta parte del README puede ser mucho más interesante: explicar cómo está construido actualmente Belafu y después presentar cómo podría evolucionar sin decir que ya tiene cosas que todavía no tiene.

# 🧩 4. Arquitectura y estructura del código

Belafu está construido con JavaScript y Discord.js, utilizando una estructura en la que la lógica principal del bot se concentra en módulos que manejan los comandos, eventos, economía, roles y sistemas automáticos.
Actualmente, una parte importante de la lógica está concentrada en logic.js, donde se encuentran los distintos sistemas del bot. Por ejemplo, el archivo contiene el manejo de comandos slash mediante handleSlashCommands(), además de la lógica de mensajes, botones, modales y actualización del ranking.

# 📁 Estructura actual

De forma simplificada, el proyecto puede representarse así:
Belafu/
│
├── index.js
│
├── logic.js
│
├── cmd.json
│
├── status.json
├── config.json
├── codes.json
│
└── package.json

Los nombres exactos de los archivos de datos pueden variar según la versión del proyecto.

# 🚀 index.js

index.js funciona como el punto de entrada del bot.
Su función principal es iniciar el cliente de Discord, cargar la configuración necesaria y conectar Belafu con Discord.
También es el lugar apropiado para ejecutar procesos que deben comenzar cuando el bot inicia, como:

Discord Client
      │
      ├── Login
      │
      ├── Registrar comandos
      │
      ├── Inicializar sistemas
      │
      └── Iniciar tareas automáticas
      
# ⚙️ logic.js

Aquí se encuentra gran parte del comportamiento de Belafu.
Actualmente existen diferentes capas de lógica:

logic.js
│
├── Slash Commands
│
├── Message Logic
│
├── Select Menus
│
├── Buttons
│
├── Modals
│
├── Economía
│
├── Reliquias
│
├── Rangos
│
├── Rankings
│
└── Developer System

Por ejemplo, los comandos slash son distribuidos mediante handleSlashCommands(interaction, client) y posteriormente un switch determina qué lógica corresponde a cada comando.

El sistema de mensajes está separado mediante executeMessageLogic(), donde actualmente se procesa, entre otras cosas, la obtención de XP y la aparición de reliquias. 

# 💰 Economía

La economía utiliza funciones y estructuras compartidas para obtener y guardar los datos de los usuarios.
Por ejemplo:
const user = getUser(
    interaction.guild.id,
    interaction.user.id
);
Después, los cambios se guardan mediante:
saveStatus();
Esto aparece en diferentes sistemas, como daily, venta de reliquias y códigos promocionales. 

# 🏆 Rankings

El sistema de Top también está separado mediante:
updateTopChannel(client)
Este obtiene los usuarios almacenados del servidor, los ordena por dinero y XP y genera el ranking correspondiente.

# 🔮 ¿Cómo podría estructurarse en el futuro?

Aunque la estructura actual funciona, a medida que Belafu crezca sería conveniente dividir logic.js.
En lugar de tener prácticamente todos los sistemas dentro del mismo archivo:
logic.js
   ↓
TODO
podría evolucionar hacia:

Belafu/
│
├── src/
│   │
│   ├── index.js
│   │
│   ├── commands/
│   │   ├── economy/
│   │   │   ├── daily.js
│   │   │   ├── balance.js
│   │   │   ├── setmoney.js
│   │   │   └── pay.js
│   │   │
│   │   ├── inventory/
│   │   │   ├── inventory.js
│   │   │   └── sell.js
│   │   │
│   │   └── admin/
│   │       ├── setxp.js
│   │       └── reset.js
│   │
│   ├── events/
│   │   ├── ready.js
│   │   ├── interactionCreate.js
│   │   └── messageCreate.js
│   │
│   ├── systems/
│   │   ├── economy.js
│   │   ├── ranks.js
│   │   ├── relics.js
│   │   ├── developer.js
│   │   └── rankings.js
│   │
│   ├── utils/
│   │   ├── database.js
│   │   ├── roles.js
│   │   └── random.js
│   │
│   └── config/
│       └── config.js
│
├── data/
│   ├── status.json
│   ├── config.json
│   └── codes.json
│
├── cmd.json
└── package.json

# 🧠 La ventaja

Así, si mañana /setmoney tiene un error, no tendrías que buscarlo entre cientos o miles de líneas de logic.js.
Irías directamente a:
commands/
└── economy/
    └── setmoney.js
Y si el problema está en la sincronización de rangos:
systems/
└── ranks.js

Esto sería una evolución natural del proyecto, no una obligación inmediata. Tu estructura actual ya separa varias responsabilidades mediante funciones como handleSlashCommands, executeMessageLogic y updateTopChannel; simplemente podría llevarse esa separación un paso más lejos.

🛠️ Belafu comenzó como un bot, pero su estructura está preparada para convertirse progresivamente en un proyecto mucho más modular.

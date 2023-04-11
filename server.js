const dotenv = require('dotenv');
const express = require('express');
const app = express();
const morgan = require('morgan');
const axios = require('axios');
const { convert } = require('html-to-text');
const { Client, GatewayIntentBits } = require('discord.js');

// Archivos de Configuraciones
dotenv.config();
const UrlMoodelServer = process.env.MOODLE_URL_Server;
const TokenMoodle = process.env.MOODLE_TOKEN_USER;
const PuertoEscuchaPlugin = process.env.MOODLE_PUERTO_ESCUCHA;
const TokenBot = process.env.DISCORD_TOKEN_BOT;
const ServerId = process.env.DISCORD_SERVER_ID;

// variables globales
var listadoForos = require('./data/canales.json');

let getPost = "mod_forum_get_discussion_posts";

//Middleware
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.set('port', process.env.PORT || PuertoEscuchaPlugin);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });


// Funcion que realiza consultas del tipo GET a Moodle Web Service
// Recibe: 
//  wsfunction: funcion de MWS que se desea consultar
//  parametro: el nombre del parametro que se necesita enviar
//  valorParametro: el valor del mismo
async function getMoodleWebServiceFunctionParams(wsfunction, parametro, valorParametro) {
    const response = await axios.get(`${UrlMoodelServer}/moodle401/webservice/rest/server.php?wstoken=${TokenMoodle}&moodlewsrestformat=json&wsfunction=${wsfunction}&${parametro}=${valorParametro}`, {
        headers: {
            // 'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            'accept-language': 'es-ES,es;q=0.9',
            'cache-control': 'max-age=0',
            'sec-ch-ua': '\'Google Chrome\';v=\'105\', \'Not)A;Brand\';v=\'8\', \'Chromium\';v=\'105\'',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '\'Windows\'',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1'
        },
    });
    if (response.data) {
        return response.data;
    } else return null;
}

// Funcion que envia mensaje a discord
async function DiscordSendMessage(channelId, post) {
    const html = post.message;
    const text = convert(html, {
        wordwrap: 130
    });
    const stringMensage = `**__${post.subject}__**\nPublicado por: ` + "`" + `${post.author.fullname}` + "`" + `\n\n${text}\n═════════════════\n`;
    client.guilds.fetch(ServerId).then(guild => guild.channels.cache.get(channelId).send(stringMensage));
}

// Funcion encargada de verificar si el Post recibido pertenece a los foros configurados
async function PostHandler(response) {
    let idforoBuscado = Number(response.other.forumid);
    // Busco si esta en el listadod e foros configurado
    for (var i = 0; i < listadoForos.length; i++) {
        if (listadoForos[i].idForo === idforoBuscado) {
            // Realizo la consulta para acceder a los datos faltantes para enviar el mensaje
            const ListadoPost = await getMoodleWebServiceFunctionParams(getPost, "discussionid", response.other.discussionid);
            ListadoPost.posts.forEach(post => {
                if (post.id === response.objectid) {
                    DiscordSendMessage(listadoForos[i].idCanalDiscord, post);
                }
            });
            break;
        }
    }
}

// Funcion encargada de verificar si la discusion recibida pertenece a los foros configurados
async function DiscussionHandler(response) {
    let idforoBuscado = Number(response.other.forumid);
    for (var i = 0; i < listadoForos.length; i++) {
        if (listadoForos[i].idForo === idforoBuscado) {
            // Realizo la consulta para acceder a los datos faltantes para enviar el mensaje
            const ListadoPost = await getMoodleWebServiceFunctionParams(getPost, "discussionid", response.objectid);
            ListadoPost.posts.forEach(post => {
                if (post.discussionid === response.objectid) {
                    DiscordSendMessage(listadoForos[i].idCanalDiscord, post);
                }
            });
            break;
        }
    }
}

// API 
// Funcion que interpreta lo recibido por el plug-in
app.post('/', function(req, res) {
    res.json({ "status": "OK" });
    switch (req.body.token) {
        case "post_created":
            // Llamo a la funcion que se encarga del manejo de post
            PostHandler(req.body);
            break;
        case "discussion_created":
            // Llamo a la funcion que se encarga del manejo de discusiones
            DiscussionHandler(req.body);
            break;
    }
});

// HealthCheck
app.get('/status', function (req, res) {
    res.status(200).send("OK, Bot FacetSocial");
})

// Iniciando el servidor
client.login(TokenBot);
app.listen(app.get('port'), () => {
    console.log(`Servidor Bot FacetSocial iniciado y escuchando en puerto: ${app.get('port')}`);
});
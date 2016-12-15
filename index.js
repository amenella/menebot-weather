'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');

let Wit = require('node-wit').Wit;
let log = require('node-wit').log;

const app = express();

// facebook page access token for the bot
// https://www.facebook.com/Menebot-weather-214420989014876
const FB_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

app.set('port', (process.env.PORT || 5000));

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}));

// Process application/json
app.use(bodyParser.json());

// Index route
app.get('/', function (req, res) {
  res.send('Hello world, I am a chat bot');
});

// for Facebook verification
app.get('/webhook/', function (req, res) {
  if (req.query['hub.verify_token'] === 'my_personal_token') {
    res.send(req.query['hub.challenge']);
  }
  res.send('Error, wrong token');
});

// Spin up the server
app.listen(app.get('port'), function () {
  console.log('running on port', app.get('port'));
});

// Process received messages
// TODO: intégrer wit
app.post('/webhook/', function (req, res) {
  let messagingEvents = req.body.entry[0].messaging;
  for (let i = 0; i < messagingEvents.length; i++) {
    let event = req.body.entry[0].messaging[i];
    let sender = event.sender.id;
    if (event.message && event.message.text) {
      let text = event.message.text;
      sendTextMessage(sender, 'Text received, echo: ' + text.substring(0, 200));
    }
  }
  res.sendStatus(200);
});

// fucntion to send back response from bot
function sendTextMessage (sender, text) {
  let messageData = { text: text };
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {access_token: FB_TOKEN},
    method: 'POST',
    json: {
      recipient: {id: sender},
      message: messageData
    }
  }, function (error, response, body) {
    if (error) {
      console.log('Error sending messages: ', error);
    } else if (response.body.error) {
      console.log('Error: ', response.body.error);
    }
  });
}

const firstEntityValue = (entities, entity) => {
  const val = entities && entities[entity] &&
    Array.isArray(entities[entity]) &&
    entities[entity].length > 0 &&
    entities[entity][0].value
  ;
  if (!val) {
    return null;
  }
  return typeof val === 'object' ? val.value : val;
};

const actions = {
  send (request, response) {
    const {sessionId, context, entities} = request;
    const {text, quickreplies} = response;
    // console.log('sending...', JSON.stringify(response));
  },
  getForecast ({context, entities}) {
    var location = firstEntityValue(entities, 'location');
    if (location) {
      context.forecast = 'sunny in ' + location; // we should call a weather API here
      delete context.missingLocation;
    } else {
      context.missingLocation = true;
      delete context.forecast;
    }
    return context;
  }
};

const WIT_TOKEN = process.env.WIT_BOT_WEATHER_TOKEN;

// Setting up our bot
const wit = new Wit({
  accessToken: WIT_TOKEN,
  actions,
  logger: new log.Logger(log.INFO)
});

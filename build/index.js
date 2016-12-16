/*       weak */
'use strict';

// dependencies
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

let Wit = require('node-wit').Wit;
let log = require('node-wit').log;

// tokens
const FB_TOKEN       = process.env.FB_PAGE_ACCESS_TOKEN;
const WIT_TOKEN       = process.env.WIT_BOT_WEATHER_TOKEN;

// api key
const WEATHER_API_KEY       = process.env.OPEN_WEATHER_MAP_API_KEY;

const app = express();

app.set('port', (process.env.PORT || 5000));

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}));

// Process application/json
app.use(bodyParser.json());

// Index route
app.get('/', (req, res) => {
  res.send('Hello world, I am a chat bot');
});

// for Facebook verification
app.get('/webhook/', (req, res) => {
  if (req.query['hub.verify_token'] === 'my_personal_token') {
    res.send(req.query['hub.challenge']);
  }
  res.send('Error, wrong token');
});

// Spin up the server
app.listen(app.get('port'), () => {
  console.log('running on port', app.get('port'));
});

// Process received messages on messenger bot from a FB user
app.post('/webhook/', (req, res) => {
  let messagingEvents          = req.body.entry[0].messaging;
  for (let i = 0; i < messagingEvents.length; i++) {
    let event = req.body.entry[0].messaging[i];
    let senderId          = event.sender.id;
    if (event.message && event.message.text) {
      // our messenger bot received a text message
      let text          = event.message.text;
      // sendTextMessage(sender, 'Text received, echo: ' + text.substring(0, 200));

      // trying to access or create the stored session of the sender
      const sessionId          = findOrCreateSession(senderId);

      // run actions of the wit bot with the corresponding user's session
      wit.runActions(
        sessionId, // the user's current session
        text, // the user's message
        sessions[sessionId].context // the user's current session state
      ).then((context) => {
        // Our bot did everything it has to do.
        // Now it's waiting for further messages to proceed.
        console.log('Waiting for next user messages');

        // // When the context of the bot is done, wipe it
        // if (context['done']) {
        //   delete sessions[sessionId];
        // }

        // Updating the user's current session state
        sessions[sessionId].context = context;
      })
      .catch((err) => {
        console.error('Oops! Got an error from Wit: ', err.stack || err);
      });

    }
  }
  res.sendStatus(200);
});

/*************************************************************************/
// Messenger API

// fucntion to send back an answer from messenger (FB)
const fbMessage = (id         , text         )                => {
  const body = JSON.stringify({
    recipient: { id },
    message: { text }
  });
  const qs          = 'access_token=' + encodeURIComponent(FB_TOKEN);
  return fetch('https://graph.facebook.com/v2.6/me/messages?' + qs, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body,
  })
  .then(rsp => rsp.json())
  .then(json => {
    if (json.error && json.error.message) {
      throw new Error(json.error.message);
    }
    return json;
  });
};

/*************************************************************************/
// Wit.ai API

// list of all user session ids
const sessions = {};

const findOrCreateSession = (fbid         )          => {
  let sessionId         ;
  // check if we already stored a session for the user which facebook id is fbid
  Object.keys(sessions).forEach(k => {
    if (sessions[k].fbid === fbid) {
      // we found the current user
      sessionId = k;
    }
  });
  if (!sessionId) {
    // no session was found for the user
    // create another one
    sessionId = new Date().toISOString();
    sessions[sessionId] = {fbid: fbid, context: {}};
  }
  return sessionId;
};

const firstEntityValue = (entities                       , entity       )       => {
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
  send ({sessionId}, {text}) {

    // trying to get the session id of the user we're talking to
    const recipientId          = sessions[sessionId].fbid;
    if (recipientId) {
      // we found the session of the current user (the recipient)
      // we're sending back the answer from our wit bot to the recipient on FB
      return fbMessage(recipientId, text)
      .then(() => null)
      .catch((err) => {
        console.error(
          'Oops! An error occurred while forwarding the response to',
          recipientId,
          ':',
          err.stack || err
        );
      });
    } else {
      console.error('Oops! Couldn\'t find user for session:', sessionId);
      // Giving the wheel back to our bot
      return Promise.resolve();
    }
  },
  getForecast ({context, entities}) {
    var location          = firstEntityValue(entities, 'location');
    let waitForWeatherApi               ;
    if (location) {
      waitForWeatherApi = getWeatherIn(location).then(response => {
        if (response.cod===200) {
          let weather          = response.weather[0].description;
          let cityName          = response.name;
          context.forecast = weather + ' in ' + cityName;
          delete context.missingLocation;
        }
      });
    } else {
      context.missingLocation = true;
      delete context.forecast;
      waitForWeatherApi = Promise.resolve(undefined); // wait for nothing,
                                            // create fulfilled promise
    }
    return waitForWeatherApi.then(() => {
        return context;
    });
  }
};

// function which we call the weather api
const getWeatherIn = (location         )                => {
  const ql          = 'q=' + encodeURIComponent(location);
  const apiKey          = 'APPID=' + encodeURIComponent(WEATHER_API_KEY);
  return fetch('http://api.openweathermap.org/data/2.5/weather?' + apiKey + '&' + ql)
  .then(rsp => rsp.json())
  .then(json => {
    if (json.error && json.error.message) {
      throw new Error(json.error.message);
    }
    return json;
  });
};

// Setting up our bot
const wit = new Wit({
  accessToken: WIT_TOKEN,
  actions,
  logger: new log.Logger(log.INFO)
});

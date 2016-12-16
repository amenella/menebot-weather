/* @flow */
'use strict';

const fetch = require('node-fetch');

let Wit = require('node-wit').Wit;
let log = require('node-wit').log;
let interactive = require('node-wit').interactive;

const WIT_TOKEN : ?string = process.env.WIT_BOT_WEATHER_TOKEN;

// api key
const WEATHER_API_KEY : ?string = process.env.OPEN_WEATHER_MAP_API_KEY;

const firstEntityValue = (entities: {[id:string]: Object}, entity:string) : any => {
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
    console.log('Menebot-weather :', JSON.stringify(response));
  },
  getForecast ({context, entities}) {
    var location : string = firstEntityValue(entities, 'location');
    let waitForWeatherApi : Promise<any>;
    if (location) {
      waitForWeatherApi = getWeatherIn(location).then(response => {
        if (response.cod===200) {
          let weather : string = response.weather[0].description;
          let cityName : string = response.name;
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
const getWeatherIn = (location : string) : Promise<any> => {
  const ql : string = 'q=' + encodeURIComponent(location);
  const apiKey : string = 'APPID=' + encodeURIComponent(WEATHER_API_KEY);
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
const wit : Object = new Wit({
  accessToken: WIT_TOKEN,
  actions,
  logger: new log.Logger(log.INFO)
});
interactive(wit);

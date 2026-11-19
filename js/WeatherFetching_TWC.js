// Forecast Weather Provider Module
// The Weather Corporation / IBM
// API Key Required

// Imports
import { AlertFormat, VFormat } from './WeatherData_Common.js';

// Module level variables.
var longitude;
var latitude;

// Variables used to configure the API endpoint (see documentation)
var urlBase;
var urlSuffix;
const urlHeader= new Headers();

function setTWCUrl() {
  // If an API key is not provided in the common_configuration.js module and the emulator
  // is running in "demonstration mode" on github.io, attempt to use an alternate url
  // which is a proxy to the TWC API with an embedded API key.
  if (CONFIG.forecastAPIKey) {
    urlBase=`https://api.weather.com`;
    urlSuffix=`&apiKey=${CONFIG.forecastAPIKey}`;
    urlHeader.append('Content-Type', 'application/json');
  } else {
    urlBase=`https://wapi.imagemaster.org`;
    urlSuffix=``;
    urlHeader.append('Content-Type', 'application/json');
    urlHeader.append('BAPI', 'TWC');
  }
}

async function fetchAlerts(alertData){
  // Processor for TWC alert containers.
  var alertCrawl = "";
  var alertCSec = "";
  var alertText = "";
  var alertCount = 0;

  for(var aIndex = 0; aIndex < alertData.alerts.length; aIndex++) {

    const detailKey = alertData.alerts[aIndex].detailKey;
    const response = await fetch(`${urlBase}/v3/alerts/detail?format=JSON&alertId=${detailKey}${urlSuffix}`,
    { method: 'GET', headers: urlHeader }
    );

    if (response.status !== 200) {
      console.log(`HTTP error! Status: ${response.status}`);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const alertRaw=data.alertDetail.texts[0].description;

    if (alertRaw !== null) {
      alertText=AlertFormat("<b>"+ data.alertDetail.eventDescription + "</b><br>" + alertRaw).replace(/\n/g," ");
      // Initialize a new AlertObj object.
      Weather.alerts[alertCount] = new Weather.AlertObj;
      // Compute a non-narration alert display time, based roughly on the length of the alert.
      Weather.alerts[alertCount].duration = 5000+(40*alertText.length); // default minimum display duration (used if not narrating)
      Weather.alerts[alertCount].dispText = alertText;
      // Set the crawl to be a constant string with all the newlines removed.
      alertCSec = AlertFormat(data.alertDetail.eventDescription + ". " + alertRaw).replace(/\n/g," ");
      // define the spoken alert text with expanded terms so the pronunciation is correct.
      Weather.alerts[alertCount].speechText=VFormat(alertCSec);
      alertCrawl = alertCrawl + " " + alertCSec;
      alertCount++; // After the new object has been created, update the total alert counter.

    }
  }
  if(alertCrawl != ""){
    CONFIG.crawl = alertCrawl;
  }
  Weather.alertsActive = alertCount;
}

async function fetchWeatherData() {
  // Append v3-alerts-headlines using a semicolon separator
  const endPoints = 'v3-wx-observations-current;v3-wx-forecast-daily-10day;v3alertsHeadlines';
  
  const queryParams = new URLSearchParams({
    geocode: `${latitude},${longitude}`,
    language: CONFIG.language,
    units: CONFIG.units,
    format: 'json'
  });

  const response = await fetch(`${urlBase}/v3/aggcommon/${endPoints}?${queryParams.toString()}${urlSuffix}`,
    { method: 'GET', headers: urlHeader }
  );

  if (response.status !== 200) {
    console.log(`HTTP error! Status: ${response.status}`);
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const rootData = await response.json();

  // -------------------------------------------------------------
  // PART 1: CURRENT CONDITIONS (v3-wx-observations-current)
  // -------------------------------------------------------------
  const currentData = rootData['v3-wx-observations-current'];
  Weather.currentTemperature = Math.round(currentData.temperature);
  Weather.currentCondition = currentData.wxPhraseLong;
  
  const windUnit = CONFIG.units === 'm' ? 'km/h' : 'mph';
  Weather.windSpeed = `${currentData.windDirectionCardinal} ${currentData.windSpeed} ${windUnit}`;
  Weather.gusts = currentData.windGust || 'NONE'; 
  Weather.feelsLike = currentData.temperatureFeelsLike;
  Weather.visibility = Math.round(currentData.visibility);
  Weather.humidity = currentData.relativeHumidity;
  Weather.dewPoint = currentData.temperatureDewPoint;
  Weather.pressure = currentData.pressureAltimeter ? currentData.pressureAltimeter.toPrecision(4) : '';
  
  const pTrend = currentData.pressureTrendPresent;
  Weather.pressureTrend = (pTrend === 'Rising') ? '▲' : (pTrend === 'Steady' || !pTrend) ? '' : '▼';
  Weather.currentIcon = currentData.iconCode;

  // -------------------------------------------------------------
  // PART 2: SEVERE WEATHER ALERTS (v3-alerts-headlines)
  // -------------------------------------------------------------
  const alertData = rootData['v3alertsHeadlines'];
  
  // Verify the payload contains alert entries and hand off to supplemental
  // processing function.
  if (alertData && CONFIG.alertsEnabled) {
    await fetchAlerts(alertData);
  } else {
    Weather.alertsActive = 0; //no alerts or alerts are disabled
  }

  // -------------------------------------------------------------
  // PART 3: DAILY FORECAST (v3-wx-forecast-daily-10day)
  // -------------------------------------------------------------
  const forecastData = rootData['v3-wx-forecast-daily-10day'];
  const daypart = forecastData.daypart[0];

  // Day night logic.
  // If it is after 3pm local time, the index =0 entry will contain all null values
  // isDay is a variable used by the sequencer to decide which pages to display.
  // and the Weather object indexes need to always reflect that index=0 is the day
  // even if it is not populated. It will not be shown in the sequence.
  let indexOffset;
  if (daypart.daypartName[0]==null) {
    isDay=false;
    indexOffset=1;
  } else {
    isDay=true;
    indexOffset=0;
  }

  for (let i = indexOffset; i <= 3; i++) {
    Weather.forecastTemp[i] = daypart.temperature[i];
    Weather.forecastIcon[i] = daypart.iconCode[i];
    Weather.forecastNarrative[i] = daypart.narrative[i];
    Weather.forecastSpeech[i] = VFormat(Weather.forecastNarrative[i]);
    Weather.forecastPrecip[i] = `${daypart.precipChance[i]}% Chance<br/> of ${daypart.precipType[i]}`;
  }

  // 7-day outlook logic.
  // Need the daytime wxPhraseLong and icon code.
  // Starting with today if isDay=True, or tomorrow if isDay=False (follows WC logic)

  for (let i = 0; i < 7; i++) {
    Weather.outlookHigh[i] = forecastData.calendarDayTemperatureMax[i+indexOffset];
    Weather.outlookLow[i] = forecastData.calendarDayTemperatureMin[i+indexOffset];

    let activePhrase = daypart.wxPhraseLong[(i*2+indexOffset)];

    // Split phrases on 2 lines to fit inside the boxes.
    let formattedCondition = activePhrase.split(' ').join('<br/>');
    if (formattedCondition.toLowerCase()==="thunderstorm") {
      formattedCondition="Thunder<br/>storm";
    }
    Weather.outlookCondition[i] = formattedCondition;
    Weather.outlookIcon[i] =  daypart.iconCode[(i*2+indexOffset)];
  }
}

export async function getWeatherTWC(p_lat,p_long){
  // Store the latitude & longitude in the module for other internal functions to use.
  latitude=p_lat;
  longitude=p_long;

  // Initialize the TWC endpoint.
  setTWCUrl();

  await fetchWeatherData();

  return true;
}

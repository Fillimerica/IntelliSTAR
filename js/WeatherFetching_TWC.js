// Forecast Weather Provider Module
// The Weather Corporation / IBM
// API Key Required


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

function KVReplace(SString,KeyPairs) {
// This function performs a bulk replacement on a string using a set of key value pairs and returns the resulting string. 

  Object.entries(KeyPairs).forEach(([key, value]) => {
   SString = SString.replaceAll(key,value);
  });

return SString;
}

function AlertFormat(RawNarrative) {
// This function removes some of the key terms from the narrative to display a more natural readability.
  var KeyTerms = {"* WHAT...":" ","* WHERE...":"Location ","* WHEN...":"Lasting ","* IMPACTS...":" ","* ADDITIONAL DETAILS...":" "};

return KVReplace(RawNarrative,KeyTerms);
}

function VFormat(RawNarrative) {
// This function replaces weather abbreviations in the narrative with the full words to allow spoken voice.
//Wind
  const WindDir = {" N ":" north "," NNE ":" north north east "," NE ":" north east "," NNW ":" north north west "," NW ":" north west ",
                 " E ":" east "," ENE ":" east north east "," ESE ":" east south east ",
                 " S ":" south "," SSE ":" south south east "," SE ":" south east "," SSW ":" south south west "," SW ":" south west ",
                 " W ":" west "," WNW ":" west north west "," WSW ":" west south west "};
//Time Zones
  const TimeZone = {" EST ":" eastern standard time "," EDT ":" eastern daylight time ",
    " CST ":" central standard time "," CDT ":" central daylight time ",
    " MST ":" mountain standard time "," MDT ":" mountain daylight time ",
    " PST ":" pacific standard time "," PDT ":" pacific daylight time ",
    " HST ":" Hawaii standard time "};
//Fractional Distances
  const FracDist = {" 1/4 ":" a quarter "," 1/2 ":" a half "," 3/4 ":" three quarters of a "};

  RawNarrative = KVReplace(RawNarrative,WindDir);
  RawNarrative = KVReplace(RawNarrative,TimeZone);
  RawNarrative = KVReplace(RawNarrative,FracDist);

  // Special to replace an altitude nnnnft prior to looking at temperature.
  RawNarrative = RawNarrative.replace(/(\d+)FT/gi," $1 feet.");

  // Temperature and velocity abbreviations.
  RawNarrative = RawNarrative.replace(/(\d+)F/gi," $1 degrees.");
  RawNarrative = RawNarrative.replace(/mph/gi,"miles per hour");

  RawNarrative = RawNarrative.replace(/(\d+)C/gi," $1 celsius.");
  RawNarrative = RawNarrative.replace(/km\/h/gi,"kilometers per hour");
return RawNarrative;
}

async function fetchForecast(){
  const response = await fetch(`${urlBase}/v1/geocode/${latitude}/${longitude}/forecast/daily/10day.json?language=${CONFIG.language}&units=${CONFIG.units}${urlSuffix}`,
    { method: 'GET', headers: urlHeader }
  );

  if (response.status !== 200) {
    console.log(`HTTP error! Status: ${response.status}`);
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const data = await response.json();

  let forecasts = data.forecasts
  // narratives
  isDay = forecasts[0].day; // If the API spits out a day forecast, use the day timings
  let ns = []
  ns.push(forecasts[0].day || forecasts[0].night); // there must be a day forecast so if the API doesn't provide one, just make it the night one. It won't show anyway.
  ns.push(forecasts[0].night);
  ns.push(forecasts[1].day);
  ns.push(forecasts[1].night);
  for (let i = 0; i <= 3; i++) {
    let n = ns[i]
    Weather.forecastTemp[i] = n.temp
    Weather.forecastIcon[i] = n.icon_code
    Weather.forecastNarrative[i] = VFormat(n.narrative)
    Weather.forecastPrecip[i] = `${n.pop}% Chance<br/> of ${n.precip_type.charAt(0).toUpperCase() + n.precip_type.substr(1).toLowerCase()}`
  }
  // 7 day outlook
  // TF Adjust 7-day start whether using the day or night forecast start. isDay controls.
  var outlookStart;
  if(isDay) {outlookStart = 0} else {outlookStart = 1};
  for (var i = 0; i < 7; i++) {
    let fc = forecasts[i+outlookStart];
    Weather.outlookHigh[i] = fc.max_temp
    Weather.outlookLow[i] = fc.min_temp
    Weather.outlookCondition[i] = (fc.day ? fc.day : fc.night).phrase_32char.split(' ').join('<br/>')
    // thunderstorm doesn't fit in the 7 day outlook boxes
    // so I multilined it similar to that of the original
    Weather.outlookCondition[i] = Weather.outlookCondition[i].replace("Thunderstorm", "Thunder</br>storm");
    Weather.outlookIcon[i] = (fc.day ? fc.day : fc.night).icon_code
  }

}

async function fetchCurrentConditions(){

//  const response = await fetch(`https://api.weather.com/v1/geocode/${latitude}/${longitude}/observations/current.json?language=${CONFIG.language}&units=${CONFIG.units}&apiKey=${CONFIG.forecastAPIKey}`);
  const response = await fetch(`${urlBase}/v1/geocode/${latitude}/${longitude}/observations/current.json?language=${CONFIG.language}&units=${CONFIG.units}${urlSuffix}`,
    { method: 'GET', headers: urlHeader }
  );

  if (response.status !== 200) {
    console.log(`HTTP error! Status: ${response.status}`);
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  const data = await response.json();

  let unit = data.observation[CONFIG.unitField];
  Weather.currentTemperature = Math.round(unit.temp);
  Weather.currentCondition = data.observation.phrase_32char;
  Weather.windSpeed = `${data.observation.wdir_cardinal} ${unit.wspd} ${CONFIG.units === 'm' ? 'km/h' : 'mph'}`;
  Weather.gusts = unit.gust || 'NONE';
  Weather.feelsLike = unit.feels_like
  Weather.visibility = Math.round(unit.vis)
  Weather.humidity = unit.rh
  Weather.dewPoint = unit.dewpt
  Weather.pressure = unit.altimeter.toPrecision(4);
  let ptendCode = data.observation.ptend_code
  Weather.pressureTrend = (ptendCode == 1 || ptendCode == 3) ? '▲' : ptendCode == 0 ? '' : '▼'; // if ptendCode == 1 or 3 (rising/rising rapidly) up arrow else its steady then nothing else (falling (rapidly)) down arrow
  Weather.currentIcon = data.observation.icon_code

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
    Weather.forecastNarrative[i] = VFormat(daypart.narrative[i]);
    Weather.forecastPrecip[i] = `${daypart.precipChance[i]}% Chance<br/> of ${daypart.precipType[i]}`;
  }

  // 7-day outlook logic.
  // Need the daytime wxPhraseLong and iconcode starting with tomorrow which is
  // daypart index = 2

  for (let i = 1; i < 8; i++) {
    Weather.outlookHigh[i-1] = forecastData.calendarDayTemperatureMax[i];
    Weather.outlookLow[i-1] = forecastData.calendarDayTemperatureMin[i];

    let activePhrase = daypart.wxPhraseLong[(i*2)];
    let activeIcon = daypart.iconCode[(i*2)];

    // Split phrases on 2 lines to fit inside the boxes.
    let formattedCondition = activePhrase.split(' ').join('<br/>');
    if (formattedCondition.toLowerCase()==="thunderstorm") {
      formattedCondition="Thunder<br/>storm";
    }
    Weather.outlookCondition[i-1] = formattedCondition;
    Weather.outlookIcon[i-1] =  daypart.iconCode[(i*2)];
  }
}

export async function getWeatherTWC(p_lat,p_long){
  // Store the latitude & longitude in the module for other internal functions to use.
  latitude=p_lat;
  longitude=p_long;

  // Initialize the TWC endpoint.
  setTWCUrl();

  await fetchWeatherData();

//  await Promise.all([
//    fetchCurrentConditions(),
//    fetchAlerts(),
//    fetchForecast()
//  ]);

  return true;
}

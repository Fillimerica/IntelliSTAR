// Forecast Weather Provider Module
// US National Weather Service for US Locations
// No API Key Required

// Imports
import { windNumToCardinal, avgWindDir, tempCtoF, tempFtoC, baroPressureInHg, ftToMiles, KMtoMiles,  getLocalHour, AlertFormat, VFormat } from './WeatherData_Common.js';


// Module level variables.
var longitude;
var latitude;

// Module level units. Configured in getWeatherNWS
var windSpeedUnit;
var temperatureUnit;
var precipitationUnit;
var forecastURL;
var nearestStationURL;


// NWS Weather API Base Url
const urlBase='https://api.weather.gov';


// NWS Icon Code Table
// Each line represents a single code and is pipe separated values. Columns/Object Properties:
// Code | DayIcon | DayDesc | DayDescNarr | NightIcon | NightDesc | NightDescNarr
const nwsCodeRaw=`
xxx|44|Undefined|Undefined NWS Day Code|44|Undefined|Undefined NWS Night Code
skc|32|Sunny|Sunny Skies|31|Clear|Clear Skies
few|34|Fair|Mostly Sunny Skies|33|Fair|Mostly Clear Skies
sct|30|Partly Cloudy|Partly Cloudy Skies|29|Partly Cloudy|Partly Cloudy Skies
bkn|28|Mostly Cloudy|Mostly Cloudy Skies|27|Mostly Cloudy Skies
ovc|26|Overcast|Overcast Skies|26|Overcast|Overcast Skies
rain|11|Rain|Rain in the Vacinity|11|Rain|Rain in the Vacinity
rain_showers|39|Showers|Showers in the Vacinity|45|Showers|Showers in the Vacinity
rain_showers_hi|40|Heavy Rain|Heavy Rain|40|Heavy Rain|Heavy Rain
tsra| 4|Thunderstorms|Thuderstorms in the Vacinity| 4|Thunderstorms|Thuderstorms in the Vacinity
tsra_sct|38|Scattered Thunderstorms|Scattered Thuderstorms|47|Scattered Thunderstorms|Scattered Thuderstorms
tsra_hi|37|Strong Thuderstorms|Strong Thuderstorms in the Area|47|Strong Thuderstorms|Strong Thuderstorms in the Area
snow|16|Snow|Moderate Snow|16|Snow|Moderate Snow
blizzard|43|Blizzard|Blizzard Conditions|43|Blizzard|Blizzard Conditions
rain_snow| 5|Rain Snow Mix|Rain/Snow Mix| 5|Rain Snow Mix|Rain/Snow Mix
rain_sleet| 6|Rain Sleet Mix|Rain/Sleet Mix| 6|Rain Sleet Mix|Rain/Sleet Mix
snow_sleet| 7|Wintry Mix|Wintry Mix| 7|Wintry Mix|Wintry Mix
fzra|10|Freezing Rain|Freezing Rain|10|Freezing Rain|Freezing Rain
rain_fzra|10|Rain Freezing Rain|Rain Freezing Rain Mix|10|Rain Freezing Rain|Rain Freezing Rain Mix
snow_fzra| 7|Freezing Rain/Snow|Freezing Rain and Snow Mix| 7|Freezing Rain/Snow|Freezing Rain and Snow Mix
sleet|18|Sleet|Sleet|18|Sleet|Sleet
fog|20|Fog|Foggy Conditions Prevail|20|Fog|Foggy Conditions Prevail
haze|21|Haze|Hazy Conditions Prevail|21|Haze|Hazy Conditions Prevail
smoke|22|Smoke|Smokey Conditions Prevail|22|Smoke|Smokey Conditions Prevail
dust|19|Dust/Sandstorm|Blowing Dust/Sandstorm|19|Dust/Sandstorm|Blowing Dust/Sandstorm
tornado| 0|Tornado|Tornado Warning|00|Tornado|Tornado Warning
tropical_storm| 1|Tropical Storm|Tropical Storm Warning| 1|Tropical Storm|Tropical Storm Warning
hurricane| 2|Hurricane|Hurricane Warning| 2|Hurricane|Hurricane Warning
hot|36|Very Hot|Unseasonably Hot|36|Very Hot|Unseasonably Hot
cold|25|Frigid|Unseasonably Cold|25|Frigid|Unseasonably Cold
fzdriz| 8|Freezing Drizzle|Freezing Drizzle| 8|Freezing Drizzle|Freezing Drizzle
snow_flurries|13|Snow Flurries|Snow Flurries|13|Snow Flurries|Snow Flurries
snow_shwrsct|41|Scattered Snow Showers|Scattered Snow Showers|46|Scattered Snow Showers|Scattered Snow Showers
snow_shwr|14|Snow Showers|Snow Showers|14|Snow Showers|Snow Showers
snow_heavy|42|Heavy Snow|Heavy Snow|42|Heavy Snow|Heavy Snow
drizzle| 9|Drizzle|Drizzle| 9|Drizzle|Drizzle
rain_sct|37|Isolated Rain|Isolated Rain|45|Isolated Rain|Isolated Rain
breezy|23|Breezy|Breezy Conditions|23|Breezy|Breezy Conditions
windy|24|Windy|Windy Conditions|24|Windy|Windy Conditions

`
const nwsCodeArray = nwsCodeRaw.trim().split('\n').map(row => { 
  const [code,DayIcon,DayDesc,DayDescNarr,NightIcon,NightDesc,NightDescNarr] = row.split('|').map(cell => cell.trim());
  return { code, DayIcon,DayDesc,DayDescNarr,NightIcon,NightDesc,NightDescNarr};
});

function getnwsCode(nwsCodeVal) {
  // This function searches for the provided nwsCode Value. If one is found, the corresponding nwsCode Object is returned.
  // If more than one is found, a random one is returned for variety.
  // If no match is found, then entry #0 is returned as the default error condition.

  const nwsSelGrp=nwsCodeArray.reduce((matches, skyCond, index) => {
    if (skyCond.code==nwsCodeVal) matches.push(index); return matches;},[]);

  let tSelector=0;
  if (nwsSelGrp.length==0) {
    nwsSelGrp.push(0);
  } else if (nwsSelGrp.length>1) {
    tSelector=Math.floor(Math.random() * nwsSelGrp.length);
  } 
  return nwsCodeArray[nwsSelGrp[tSelector]];
}

function mapNWSTextToNWSCode(shortForecast) {
  // This function attempts to interpret the nws short forecast string and 
  // returns the corresponding nwsCode to be used in the sky condition lookup.

  if (typeof iconStr == "string") {
    const text = (shortForecast || '').split(/\bthen\b/i).toLowerCase();
 
    // Severe & Convective
    if (/\b(tornado|funnel)\b/.test(text)) return 'tornado';
    if (/\bhurricane\b/.test(text)) return 'hurricane';
    if (/\btropical storm\b/.test(text)) return 'tropical_storm';
    if (/\b(isolated|slight chance).*(thunderstorm|t-storm)\b/.test(text)) return 'tsra_hi';
    if (/\b(scattered|chance).*(thunderstorm|t-storm)\b/.test(text)) return 'tsra_sct';
    if (/\b(thunderstorm|t-storm|thunder)\b/.test(text)) return 'tsra';

    // Winter Precipitation
    if (/\bblizzard\b/.test(text)) return 'blizzard';
    if (/\bfreezing drizzle\b/.test(text)) return 'fzdriz';
    if (/\bfreezing rain\b/.test(text)) return 'fzra';
    if (/\brain and snow\b/.test(text)) return 'rain_snow';
    if (/\brain and sleet\b/.test(text)) return 'rain_sleet';
    if (/\bwintry mix\b/.test(text)) return 'snow_sleet';
    if (/\b(sleet|ice pellets)\b/.test(text)) return 'sleet';
    if (/\bflurries\b/.test(text)) return 'snow_flurries';
    if (/\b(scattered|chance).*snow showers\b/.test(text)) return 'snow_shwrsct'
    if (/\bsnow showers\b/.test(text)) return 'snow_shwr';
    if (/\bheavy snow\b/.test(text)) return 'snow_heavy';
    if (/\b(snow|blowing snow)\b/.test(text)) return 'snow';

    // Liquid Precipitation
    if (/\bdrizzle\b/.test(text)) return 'drizzle';
    if (/\bheavy rain\b/.test(text)) return 'rain_showers_hi';
    if (/\b(scattered|chance|isolated).*(showers|rain)\b/.test(text)) return 'rain_sct';
    if (/\bshowers\b/.test(text)) return 'rain_showers';
    if (/\brain\b/.test(text)) return 'rain';

    // Obstructions & Wind
    if (/\b(fog|mist)\b/.test(text)) return 'fog';
    if (/\bhaze\b/.test(text)) return 'haze';
    if (/\bsmoke\b/.test(text)) return 'smoke';
    if (/\bdust\b/.test(text)) return 'dust';
    if (/\b(windy|blustery|gale)\b/.test(text)) return 'windy';
    if (/\bbreezy\b/.test(text)) return 'breezy';

    // Sky Cover
    if (/\b(overcast|cloudy)\b/.test(text) && !/\b(partly|mostly)\b/.test(text)) return 'ovc';
    if (/\bmostly cloudy\b/.test(text)) return 'bkn';
    if (/\b(partly sunny|partly cloudy)\b/.test(text)) return 'sct';
    if (/\b(a few clouds|mostly sunny|mostly clear|fair)\b/.test(text)) return 'few';
    if (/\b(sunny|clear)\b/.test(text)) return 'skc';
  }
  return 'xxx'; // TWC Not Available (N/A)
}

function getNWSCodeFromIcon(iconStr,shortFcst="") {
  // This function extracts the nws sky condition code from the provided icon string 
  // (between the trailing slash and the following question mark). If a code can't be found, then 
  // the alternate sky condition string is interpreted instead.
  // Returns the corresponding nwsCode object from the nwsCode table above.
  let nwsCode="";
  if (typeof iconStr == "string") {
    const extractCode=iconStr.match("\/([^\/,?]+)[,?]")
    if (extractCode) {nwsCode=extractCode[1];}
  }
  // If nwsCode is empty, fall-back to a lookup using shortFcst instead.
  if (nwsCode=="") {
    console.log(`GetNWSCodeFromIcon UNABLE TO GET CODE FROM ICON. Trying Short Description. icon=${iconStr} | description=${shortFcst}`);
    nwsCode=mapNWSTextToNWSCode(shortFcst);
  }
  
  // Finally return the cross-referenced code object.
  return getnwsCode(nwsCode);
}

async function fetchAPIData(urlStr) {
  // This function fetches the data from the API and
  // performs simple error checking before returning the result.

  const response = await fetch(urlStr);

  if (response.status !== 200) {
    console.log(`HTTP error! Status: ${response.status} from call to url: ${urlStr}`);
    throw new Error(`HTTP error! Status: ${response.status} from call to url: ${urlStr}`);
  }
  const rootData = await response.json();

  return rootData;
}

// Retrieve any active alerts from the US National Weather Service, which should work for US locations.
async function fetchNWSAlerts(){
  var alertCrawl = "";
  var alertCSec = "";
  var alertText = "";
  var alertCount = 0;
  var alertDup = false;

  Weather.alertsActive = 0 ;
  // Only fetch alerts if the global setting allows, 
  if(CONFIG.alertsEnabled) {
    const data=await fetchAPIData(`${urlBase}/alerts/active?point=${latitude},${longitude}`);
    if (data.features !== undefined) {
      for(var i = 0; i < data.features.length; i++) {
        alertText=AlertFormat("<b>"+data.features[i].properties.event + "</b><br>" + data.features[i].properties.description).replace(/\n/g," ");
        // If alerts already exist, need to compare the dispText values to avoid duplicates.
        alertDup=false;
        if (alertCount>0){
          for(var i2 = 0; i2 < alertCount; i2++) {
            if (alertText==Weather.alerts[i2].dispText) {
              alertDup=true;
              break;
            }
          }
        }
        if (!alertDup) {
          // Initialize a new AlertObj object.
          Weather.alerts[alertCount] = new Weather.AlertObj;
          // Compute a non-narration alert display time, based roughly on the length of the alert.
          Weather.alerts[alertCount].duration = 5000+(40*alertText.length); // default minimum display duration (used if not narrating)
          Weather.alerts[alertCount].dispText = alertText;
          // Set the crawl to be a constant string with all the newlines removed.
          alertCSec = AlertFormat(data.features[i].properties.event + ". " + data.features[i].properties.description).replace(/\n/g," ");
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
  }
}

async function fetchWeatherCurrent() {
  // NWS Query for Current Conditions (and a slight look-back for pressure to calculate a simple trend).
  // for the current conditions, all numeric values are in metric (temp,dew point,pressure,wind, visibility)

  const rootData = await fetchAPIData(`${nearestStationURL}/observations?limit=24`);

  // CURRENT CONDITIONS 
  // Sometimes the reporting station doesn't report but the automated system logs an observation
  // nonetheless. If the temperature values are invalid, then try to obtain the last valid reporting period.
  let currentData = rootData.features[0].properties;
  if (currentData.temperature.value==null) {
   for (let i=1; i<24; i++) {
      currentData=rootData.features[i].properties;
      if (currentData.temperature.value != null) {break;}
    }
  }
  // Even with this observation validation, specific parameters might still be missing and need to be validated
  // individually.

  // Temperature, dew point, and humidity.
  if (currentData.temperature.value != null) {
    if (temperatureUnit=='fahrenheit') {
      Weather.currentTemperature = Math.round(tempCtoF(currentData.temperature.value));
      Weather.dewPoint = Math.round(tempCtoF(currentData.dewpoint.value));
    } else {
      Weather.currentTemperature = Math.round(currentData.temperature.value);
      Weather.dewPoint = Math.round(currentData.dewpoint.value);
    }
  } else {
    Weather.currentTemperature='n/a';
    Weather.dewPoint='n/a';
  }
 
  if (currentData.relativeHumidity.value != null) {
    Weather.humidity = Math.round(currentData.relativeHumidity.value);
  }

  // Gets the weather code object for the code provided by the nws icon or short description.
  let currConditionObj = getNWSCodeFromIcon(currentData.icon,currentData.textDescription);

  // Some reporting stations don't provide  an icon or textDescription for every reporting period.
  // If the code comes back as unknown xxx, try getting the code from a prior reporting period instead.
  if (currConditionObj.code=='xxx') {
    for (let i=1; i<24; i++) {
      const obsPeriod=rootData.features[i].properties;
      currConditionObj = getNWSCodeFromIcon(obsPeriod.icon,obsPeriod.textDescription);
      if (currConditionObj.code != 'xxx') {break;}
    }
  }

  // Determine whether to use the day or night text and icon codes based on the time of day.
  const localHour=getLocalHour(Weather.TimeZone);

  if (localHour>5 && localHour<18) {
    // Daytime Icons and Conditions
    Weather.currentCondition = currConditionObj.DayDesc;
    Weather.currentIcon = currConditionObj.DayIcon;
  } else {
    // Nighttime Icons and Conditions
    Weather.currentCondition = currConditionObj.NightDesc;
    Weather.currentIcon = currConditionObj.NightIcon;
  }

  // Winds
  if (currentData.windSpeed.value != null) {
    if (windSpeedUnit=='mph') {
      Weather.windSpeed = `${windNumToCardinal(currentData.windDirection.value)} ${Math.round(KMtoMiles(currentData.windSpeed.value))} ${windSpeedUnit}`;  
      Weather.gusts = Math.round(KMtoMiles(currentData.windGust.value));
    } else {
      Weather.windSpeed = `${windNumToCardinal(currentData.windDirection.value)} ${Math.round(currentData.windSpeed.value)} ${windSpeedUnit}`;  
      Weather.gusts = Math.round(KMtoMiles(currentData.windGust.value));
    }
  } else {
    Weather.windSpeed='n/a';
    Weather.gusts='n/a';
  }

  // Feels like temperature if available.
  if (currentData.windChill.value != null) {
    if (temperatureUnit=='fahrenheit') {
      Weather.feelsLike = Math.round(tempCtoF(currentData.windChill.value));
    } else {
      Weather.feelsLike = Math.round(currentData.windChill.value);      
    }
  } else if (currentData.heatIndex.value != null) {
    if (temperatureUnit=='fahrenheit') {
      Weather.feelsLike = Math.round(tempCtoF(currentData.heatIndex.value));
    } else {
      Weather.feelsLike = Math.round(currentData.heatIndex.value);      
    }
  } else {
    Weather.feelsLike = Weather.currentTemperature;
  }

  // Visibility (comes in as meters)
  if (currentData.visibility.value != null) {
    if (windSpeedUnit=='mph') {
      // Converting from meters to miles
      Weather.visibility = Math.round(KMtoMiles(currentData.visibility.value/1000));
    } else {
      // Converting from meters to kilometers
      Weather.visibility = Math.round(currentData.visibility.value/1000);
    }
  } else {
    Weather.visibility='n/a';
  }


  // Barometric pressure from current, trend from 3 hours prior to current.
  // For station observations, there may be sea level pressure or current elevation pressure.
  // Values are in Pascals. Convert to InHg if temperatureUnit=='fahrenheit', otherwise convert to hPa.
  let curBaroPressure=0;
  let histBaroPressure=0;
  if (currentData.seaLevelPressure.value != null) {
    curBaroPressure=currentData.seaLevelPressure.value/100;
    histBaroPressure=rootData.features[23].properties.seaLevelPressure.value/100;
  } else if (currentData.barometricPressure.value != null) {
    curBaroPressure=currentData.barometricPressure.value/100;
    histBaroPressure=rootData.features[23].properties.barometricPressure.value/100;
  }
  if (curBaroPressure>0) {
    if (temperatureUnit=='fahrenheit') {
      Weather.pressure = Math.round(baroPressureInHg(curBaroPressure)*100)/100; // Round to 2 decimal places.
    } else {
      Weather.pressure = Math.round(curBaroPressure*100)/100; // Round to 2 decimal places.
    }

    const pressDelta = (curBaroPressure-histBaroPressure);
    if (pressDelta>1.5) {
      Weather.pressureTrend = ' ▲';
    } else if (pressDelta<-1.5) {
      Weather.pressureTrend = ' ▼';
    } else {
      Weather.pressureTrend = '';
    }
  } else {
    Weather.pressure='n/a';
    Weather.pressureTrend='';
  }
}

async function fetchWeatherForecast() {
  // NWS forecast query for next 7 days in 12-hour steps.

  const rootData = await fetchAPIData(forecastURL);

  // 7-Day Forecast 12-hour blocks starting either this morning or this evening 
  // isDaytime(Boolean) indicates whether block 0 is day or night starting.
  const forecastData = rootData.properties.periods;

  // There are 4 forecast periods:
  // current day, current night, tomorrow day, and tomorrow night.
  // NWS returns a set of day/night forecast blocks 12-hours long.

  // Day night logic.
  // isDay is a variable used by the sequencer to decide which pages to display.
  // The Weather object indexes need to always reflect that index=0 is the day.
  // If it has passed, then it will not be shown in the sequence.

  // If day has already passed isDaytime will be false and the day forecast is not provided.
  let dayNightBias=1;
  isDay=false;
  if (forecastData[0].isDaytime) {
    dayNightBias=0;
    isDay=true;
  }

  for (let i = dayNightBias; i <= 3; i++) {
    
    // Gets the weather code object for the code provided by the nws icon or short description.
    const currConditionObj = getNWSCodeFromIcon(forecastData[i-dayNightBias].icon,forecastData[i-dayNightBias].shortForecast);
    if (i==0 || i==2) {
      // Day Period
      Weather.forecastIcon[i] = currConditionObj.DayIcon;
    } else {
      // Night Period
      Weather.forecastIcon[i] = currConditionObj.NightIcon;
    }
    // NWS temperature data may be in either fahrenheit or celsius. Check units provided to see if a conversion
    // is needed.
    const tempUnit=forecastData[i-dayNightBias].temperatureUnit;
    if (temperatureUnit=='fahrenheit') {
      if (tempUnit=="F") {
        // No conversion required.
        Weather.forecastTemp[i] = Math.round(forecastData[i-dayNightBias].temperature);
      } else {
        Weather.forecastTemp[i] = Math.round(tempFtoC(forecastData[i-dayNightBias].temperature));
      }
    } else {
      if (tempUnit=="C") {
        // No conversion required.
        Weather.forecastTemp[i] = Math.round(forecastData[i-dayNightBias].temperature);
      } else {
        Weather.forecastTemp[i] = Math.round(tempCtoF(forecastData[i-dayNightBias].temperature));
      }
    }

    // forecastPrecip: PrecipType is derived from the weather_code if precipChance >40, otherwise default to 'precip'
    // also normalize probability values to multiples of 10%.
    const precipChance=Math.round(forecastData[i-dayNightBias].probabilityOfPrecipitation.value*.1)*10;
    let precipType='precip';
    if (precipChance>40) {
      // weather_code has a distinguishing precipitation type
      if (i==0 || i==2) {
        // Day Period
        precipType=currConditionObj.DayDesc;
      } else {
        // Night Period
        precipType=currConditionObj.NightDesc;
      }
    }
    Weather.forecastPrecip[i] = `${precipChance}% Chance<br/> of ${precipType}`;

    // forecastNarrative 
    Weather.forecastNarrative[i] = forecastData[i-dayNightBias].detailedForecast;

    // Format the narration with expanded terms for speech.
    Weather.forecastSpeech[i] = VFormat(Weather.forecastNarrative[i]);
  }

  // 7-day outlook logic. 1st day starts on the next day period.

  for (let i = 0; i < 7; i++) {
    // Calculate min and max temperatures over the current day. (Two 12-hour periods)
    // Exception: If starting with the next day (because the current day is done)
    // then the 7th day will not have a night forecast available. This affects the low temperature.
    let minTemp=forecastData[(i*2)+dayNightBias].temperature;
    let maxTemp=minTemp;
    let isMinTempValid=true;
    if (((i*2)+dayNightBias+1)>13) {
      isMinTempValid=false
    }
    if (isMinTempValid) {
      const tTemp=forecastData[(i*2)+dayNightBias+1].temperature;
      if (tTemp>maxTemp) { maxTemp=tTemp;}
      if (tTemp<minTemp) { minTemp=tTemp;}
    }

    // NWS temperature data may be in either fahrenheit or celsius. Check units provided to see if a conversion
    // is needed.
    const tempUnit=forecastData[(i*2)+dayNightBias].temperatureUnit;
    if (temperatureUnit=='fahrenheit') {
      if (tempUnit=="F") {
        // No conversion required.
        Weather.outlookHigh[i] = Math.round(maxTemp);
        Weather.outlookLow[i] = Math.round(minTemp);
      } else {
        Weather.outlookHigh[i] = Math.round(tempFtoC(maxTemp));
        Weather.outlookLow[i] = Math.round(tempFtoC(minTemp));
      }
    } else {
      if (tempUnit=="C") {
        // No conversion required.
        Weather.outlookHigh[i] = Math.round(maxTemp);
        Weather.outlookLow[i] = Math.round(minTemp);
      } else {
        Weather.outlookHigh[i] = Math.round(tempCtoF(maxTemp));
        Weather.outlookLow[i] = Math.round(tempCtoF(minTemp));
      }
    }
    // Check if the low temp should be omitted (see reason above)
    if (!isMinTempValid) {
      Weather.outlookLow[i] = "--";
    }

    // Condition and icon come from the day period.
    // Gets the weather code object for the code provided by the nws icon or short description.
    const currConditionObj = getNWSCodeFromIcon(forecastData[(i*2)+dayNightBias].icon,forecastData[(i*2)+dayNightBias].shortForecast);
    const activePhrase = forecastData[(i*2)+dayNightBias].shortForecast;
    // Split phrases on 2 lines to fit inside the boxes.
    const formattedCondition = activePhrase.split(' ').join('<br/>');

    Weather.outlookCondition[i] = formattedCondition;
    Weather.outlookIcon[i] = currConditionObj.DayIcon;
  }
}

export async function getWeatherNWS(p_lat,p_long){
  // Store the latitude & longitude in the module for other internal functions to use.
  latitude=p_lat.toFixed(4);
  longitude=p_long.toFixed(4);

  // NWS requires multiple configuration queries to get the forecastURL
  // and the nearest reporting station for current conditions.
  const respData = await fetchAPIData(`${urlBase}/points/${latitude},${longitude}`);
  const obsStationURL = respData.properties.observationStations;
  const respData2 = await fetchAPIData(obsStationURL);
  forecastURL = respData.properties.forecast;
  nearestStationURL = respData2.observationStations[0];

  // Units configuration
  switch (CONFIG.units) {
    case 'e': {
      // US English / Imperial
      windSpeedUnit=`mph`;
      temperatureUnit=`fahrenheit`;
      precipitationUnit=`inch`;
      break;
    }
    case 'm': {
      // Metric km/h, Celsius, mm
      windSpeedUnit=`km/h`;
      temperatureUnit=`celsius`;
      precipitationUnit=`millimeter`;
      break;
    }
    case 'h': {
      // UK mph, Celsius, mm
      windSpeedUnit=`mph`;
      temperatureUnit=`celsius`;
      precipitationUnit=`millimeter`;
      break;
    }
  }

  await Promise.all([fetchWeatherCurrent(),fetchNWSAlerts(),fetchWeatherForecast()]);
  return true;
}

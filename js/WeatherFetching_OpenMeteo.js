// Forecast Weather Provider Module
// Open-Meteo + NWS for US Alerts
// No API Key Required

// Imports
import { windNumToCardinal, avgWindDir, baroPressureInHg, ftToMiles, getLocalHour, AlertFormat, VFormat } from './WeatherData_Common.js';


// Module level variables.
var longitude;
var latitude;

// Module level units. Configured in getWeatherOpenMeteo
var windSpeedUnit;
var temperatureUnit;
var precipitationUnit;

// Open-Meteo Weather API Base Url
const urlBase='https://api.open-meteo.com/v1/forecast'

// WMO Code Table
// Each line represents a single code and is pipe separated values. Columns/Object Properties:
// Code | DayIcon | DayDesc | DayDescNarr | NightIcon | NightDesc | NightDescNarr
const wmoCodeRaw=`
-1|0 |Undefined|Undefined wmo Day Code|0 |Undefined|Undefined wmo Night Code
 0|32|Sunny|Sunny Skies|31|Clear|Clear Skies
 1|34|Fair|Mostly Sunny Skies|33|Fair|Mostly Clear Skies
 2|30|Partly Cloudy|Partly Cloudy Skies|29|Partly Cloudy|Partly Cloudy Skies
 3|26|Overcast|Overcast Skies|26|Overcast|Overcast Skies
45|20|Fog|Foggy Conditions Prevail|20|Fog|Foggy Conditions Prevail
48|25|Freeezing Fog|Freezing Fog Prevails|25|Freezing Fog|Freezing Fog Prevails
51| 9|Light Drizzle|Light Drizzle| 9|Light Drizzle|Light Drizzle
53| 9|Moderate Drizzle|Moderate Drizzle| 9|Moderate Drizzle|Moderate Drizzle
55| 9|Dense Drizzle|Dense Drizzle| 9|Dense Drizzle|Dense Drizzle
56| 8|Freezing Drizzle|Freezing Drizzle| 8|Freezing Drizzle|Freezing Drizzle
57| 8|Dense Freezing Drizzle|Dense Freezing Drizzle| 8|Dense Freezing Drizzle|Dense Freezing Drizzle
61|12|Light Rain|Light Rain in the Vacinity|12|Light Rain|Light Rain in the Vacinity
63|12|Rain|Rain in the Vacinity|12|Rain|Rain in the Vacinity
65|40|Heavy Rain|Heavy Rain|40|Heavy Rain|Heavy Rain 
66|10|Freezing Rain|Light Freezing Rain|10|Freezing Rain|Light Freezing Rain
67|10|Freezing Rain|Heavy Freezing Rain|10|Freezing Rain|Heavy Freezing Rain
71|13|Snow Flurries|Snow Flurries|13|Snow Flurries|Snow Flurries
73|16|Snow|Moderate Snow|16|Snow|Moderate Snow
75|42|Heavy Snow|Heavy Snow|42|Heavy Snow|Heavy Snow
77|18|Sleet|Sleet|18|Sleet|Sleet
80|39|Scattered Showers|Scattered Showers in the Vacinity|45|Scattered Showers|Scattered Showers in the Vacinity
81|11|Showers|Showers in the Vacinity|11|Showers|Showers in the Vacinity
82|40|Heavy Showers|Strong Showers in the Vacinity|40|Heavy Showers|Strong Showers in the Vacinity
85|41|Snow Showers|Scattered Snow Showers|46|Snow Showers|Scattered Snow Showers
86|42|Heavy Snow Showers|Heavy Snow Showers|42|Heavy Snow Showers|Heavy Snow Showers
95| 4|Thunderstorms|Thuderstorms in the Vacinity| 4|Thunderstorms|Thuderstorms in the Vacinity
96|17|Thunder Hail|Thuderstorms with a slight chance of hail possible|17|Thunder Hail|Thuderstorms with a slight chance of hail possible
97| 3|Strong Thuderstorms|Strong Thuderstorms in the Area| 3|Strong Thuderstorms|Strong Thuderstorms in the Area
99|17|Thunder Hail|Strong Thuderstorms with hail likely|17|Thunder Hail|Strong Thuderstorms with hail likely
`
const wmoCodeArray = wmoCodeRaw.trim().split('\n').map(row => { 
  const [code,DayIcon,DayDesc,DayDescNarr,NightIcon,NightDesc,NightDescNarr] = row.split('|').map(cell => cell.trim());
  return { code: Number(code), DayIcon,DayDesc,DayDescNarr,NightIcon,NightDesc,NightDescNarr};
});

function getwmoCode(wmoCodeVal) {
  // This function searches for the provided wmoCode Value. If one is found, the corresponding wmoCode Object is returned.
  // If more than one is found, a random one is returned for variety.
  // If no match is found, then entry #0 is returned as the default error condition.

  const wmoSelGrp=wmoCodeArray.reduce((matches, skyCond, index) => {
    if (skyCond.code==wmoCodeVal) matches.push(index); return matches;},[]);

  let tSelector=0;
  if (wmoSelGrp.length==0) {
    wmoSelGrp.push(0);
  } else if (wmoSelGrp.length>1) {
    tSelector=Math.floor(Math.random() * wmoSelGrp.length);
  } 
  return wmoCodeArray[wmoSelGrp[tSelector]];
}

function buildNarrative(forecastData,perIdx,fType) {
  // This function builds the weather narration from the forecast Data using the following rules:
  // Sentence 1: Forecast conditions.
  // If the wmoCode is the same for both periods, then the condition is set.
  // If the wmoCode is different for the period, then the sentence will have a "becoming" or "turning" "or later in the day/night."
  // Sentence 2: Temperature change and high low.
  // Rules: If day and temp increases, report high temp. If night and temp decreases, report low temp.
  // If steady than report as steady.
  // If backwards then report that temp will be increasing/decreasing throughout the day/night.
  // Sentence 3: Winds.
  // Rules: Calculate the maximum wind speed and categorize as follows:
  // 0=Calm, <5=Light & Variable, otherwise report low to high at the average direction.
  // If reporting wind speeds, then also report the max gusts if they are greater than the max winds.


  let fullNarr="";
  const wmoCodeObj1=getwmoCode(forecastData.weather_code[perIdx]);
  const wmoCodeObj2=getwmoCode(forecastData.weather_code[perIdx+1]);

  switch (fType) {
    case "DAY": {
      // S1: Start
      fullNarr+=wmoCodeObj1.DayDescNarr;
      // S1: Compare wmoCodes
      if (wmoCodeObj1.code!=wmoCodeObj2.code) {
        fullNarr+=' then '+wmoCodeObj2.DayDescNarr+' later in the day';
      }
      fullNarr+='.\n';
      
      // S2: Temperature
      const sTemp=Math.round(forecastData.temperature_2m[perIdx]);
      const eTemp=Math.round(forecastData.temperature_2m[perIdx+1]);
      if (eTemp>sTemp) {
        // Normal day temp progression.
        fullNarr+=`High of ${eTemp} degrees`;
      } else if (eTemp<sTemp) {
        // Reverse daytime progression, (getting cooler)
        fullNarr+=`Temperature falling to ${eTemp} degrees`
      } else {
        // Temperatures remaining steady.
        fullNarr+=`Temperature steady at ${eTemp} degrees`
      }
      fullNarr+='.\n';
      break;
    }

    case "NIGHT": {
      // S1: Start
      fullNarr+=wmoCodeObj1.NightDescNarr;
      // S1: Compare wmoCodes
      if (wmoCodeObj1.code!=wmoCodeObj2.code) {
        fullNarr+=' then '+wmoCodeObj2.NightDescNarr+' later in the night';
      }
      fullNarr+='.\n';
      
      // S2: Temperature
      const sTemp=Math.round(forecastData.temperature_2m[perIdx]);
      const eTemp=Math.round(forecastData.temperature_2m[perIdx+1]);
      if (eTemp<sTemp) {
        // Normal night temp progression.
        fullNarr+=`Low of ${eTemp} degrees`;
      } else if (eTemp>sTemp) {
        // Reverse nighttime progression, (getting warmer)
        fullNarr+=`Temperature rising to ${eTemp} degrees`
      } else {
        // Temperatures remaining steady.
        fullNarr+=`Temperature steady at ${eTemp} degrees`
      }
      fullNarr+='.\n';
      break;
    }
  }
  // Winds are common to both day & night
  // Sentence 3: Winds
  const sWindSpeed=Math.round(forecastData.wind_speed_10m[perIdx]);
  const eWindSpeed=Math.round(forecastData.wind_speed_10m[perIdx+1]);
  const windMax=Math.max(sWindSpeed,eWindSpeed);
  const windMin=Math.min(sWindSpeed,eWindSpeed);
  const sWindGusts=Math.round(forecastData.wind_gusts_10m[perIdx]);
  const eWindGusts=Math.round(forecastData.wind_gusts_10m[perIdx+1]);
  const windGustsMax=Math.max(sWindGusts,eWindGusts);
  const windAvgDir=avgWindDir(forecastData.wind_direction_10m[perIdx],forecastData.wind_direction_10m[perIdx+1])
  if (windMax<1) {
    // Consider this as calm.
    fullNarr+=`Winds are calm`
  } else if (windMax<5) {
    // Consider this as light and variable.
    fullNarr+=`Winds light and variable`
  } else {
    // The winds are strong enough to report.
    if (windMax==windMin) {
      fullNarr+=`Winds ${windNumToCardinal(windAvgDir)} at ${windMin} `;
    } else {
      fullNarr+=`Winds ${windNumToCardinal(windAvgDir)} at ${windMin} to ${windMax} `;
    }
    // Add the correct units identifier.
    fullNarr+=windSpeedUnit;
    // See if there are gusts.
    if (windGustsMax>(windMax+5)) {
      fullNarr+=` gusting to ${windGustsMax} `
      // Add the correct units identifier.
      fullNarr+=windSpeedUnit;
    }
  }
  fullNarr+='.\n';

  return fullNarr;
}

// Historically, the original TWC based WeatherFetching.js used the US National Weather Service
// query to support US only Weather Watches and Warnings. Non-US alerts were ignored.
// Since open-meteo does not provide alerts, the default is to attempt to get them from
// the US National Weather Service, which should work for US locations.
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
  // Open-Meteo Query for Current Conditions (and a slight look-back for pressure to calculate a simple trend).

  const queryParams = new URLSearchParams({
    latitude: `${latitude}`,
    longitude: `${longitude}`,
    hourly: `pressure_msl`,
    current: `temperature_2m,dew_point_2m,visibility,relative_humidity_2m,apparent_temperature,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m`,
    forecast_days: 1,
    wind_speed_unit: windSpeedUnit,
    temperature_unit: temperatureUnit,
    precipitation_unit: precipitationUnit,
    forecast_hours: 1,
    past_hours: 6
  });

  const response = await fetch(`${urlBase}?${queryParams.toString()}`,
    { method: 'GET'}
  );

  if (response.status !== 200) {
    console.log(`HTTP error! Status: ${response.status}`);
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const rootData = await response.json();

  // CURRENT CONDITIONS 
  const currentData = rootData['current'];
  
  Weather.currentTemperature = Math.round(currentData.temperature_2m);

  // Gets the weather code object for the code provided by open-meteo
  const currConditionObj = getwmoCode(currentData.weather_code);

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

  const windUnit =rootData['current_units'].wind_speed_10m
  Weather.windSpeed = `${windNumToCardinal(currentData.wind_direction_10m)} ${Math.round(currentData.wind_speed_10m)} ${windUnit}`;
  Weather.gusts = Math.round(currentData.wind_gusts_10m) || 'NONE'; 
  Weather.feelsLike = Math.round(currentData.apparent_temperature);
  Weather.humidity = Math.round(currentData.relative_humidity_2m);
  Weather.visibility = Math.round(ftToMiles(currentData.visibility));
  Weather.dewPoint = Math.round(currentData.dew_point_2m);

  // Barometric pressure from current, trend from hourly data.
  Weather.pressure = Math.round(baroPressureInHg(currentData.pressure_msl)*100)/100; // Round to 2 decimal places.

  const pressDelta = (currentData.pressure_msl - rootData['hourly'].pressure_msl[0]);
  if (pressDelta>0.5) {
    Weather.pressureTrend = '▲';
  } else if (pressDelta<-0.5) {
    Weather.pressureTrend = '▼';
  } else {
    Weather.pressureTrend = '';
  }
}

async function fetchWeatherForecast() {
  // Open-Meteo forecast query for next 7 days in 6-hour steps.

  // Need date span in yyy-mm-dd anchored by today in the local time zone and +8
  const tDate=new Date();
  const sDate=new Intl.DateTimeFormat('en-CA',{timeZone: Weather.timeZone, year: 'numeric', month: '2-digit', day: '2-digit'}).format(tDate);
  // Move tDate to +8 day ahead
  tDate.setDate(tDate.getDate()+8);
  const eDate= new Intl.DateTimeFormat('en-CA',{timeZone: Weather.timeZone, year: 'numeric', month: '2-digit', day: '2-digit'}).format(tDate);

// hourly=weather_code,precipitation_probability,wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m&timezone=America%2FLos_Angeles&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch&start_date=2026-11-16&end_date=2026-11-18&temporal_resolution=hourly_6
  const queryParams = new URLSearchParams({
    latitude: `${latitude}`,
    longitude: `${longitude}`,
    hourly: `weather_code,precipitation_probability,wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,cloud_cover`,
    timezone: Weather.timeZone,
    wind_speed_unit: windSpeedUnit,
    temperature_unit: temperatureUnit,
    temporal_resolution: `hourly_6`,
    start_date: sDate,
    end_date: eDate
  });

  const response = await fetch(`${urlBase}?${queryParams.toString()}`,
    { method: 'GET'}
  );

  if (response.status !== 200) {
    console.log(`HTTP error! Status: ${response.status}`);
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  const rootData = await response.json();

  // 2-Day Forecast 6-hour blocks starting at midnight.
  const forecastData = rootData['hourly'];

  // Day night logic.
  // isDay is a variable used by the sequencer to decide which pages to display.
  // The Weather object indexes need to always reflect that index=0 is the day.
  // If it has passed, then it will not be shown in the sequence.
  const localHour=getLocalHour(Weather.TimeZone);
  if (localHour>5 && localHour<18) {
    isDay=true;
  } else {
    isDay=false;
  }

  // There are 4 forecast periods:
  // current day, current night, tomorrow day, and tomorrow night.
  // and Open-Meteo is set to return two data pairs per period, 6 hours apart.
  // The logic for each weather parameter is provided below.
  // Note that in many cases the logic changes depending on whether it is a day period or a night period.

  for (let i = 0; i <= 3; i++) {
    
    // forecastIcon: When not equal, use the trailing code.
    // Gets the weather code object for the code provided by open-meteo
    const weather_codeObj = getwmoCode(forecastData.weather_code[2*i+2]);

    // forecastTemp: Day=highest of the two values, Night=lowest of the two values
    if (i==0 || i==2) {
      // Day Period
      Weather.forecastTemp[i] = Math.round(Math.max(forecastData.temperature_2m[2*i+1],forecastData.temperature_2m[2*i+2]));
      Weather.forecastIcon[i] = weather_codeObj.DayIcon;
    } else {
      // Night Period
      Weather.forecastTemp[i] = Math.round(Math.min(forecastData.temperature_2m[2*i+1],forecastData.temperature_2m[2*i+2]));
      Weather.forecastIcon[i] = weather_codeObj.NightIcon;
    }

    // forecastPrecip: PrecipType is derived from the weather_code if >50, otherwise default to 'precip'
    // also normalize probability values to multiples of 10%.
    const precipChance=Math.round(forecastData.precipitation_probability[2*i+2]*.1)*10
    let precipType='precip';
    if (weather_codeObj.code>50) {
      // weather_code has a distinguishing precipitation type
      if (i==0 || i==2) {
        // Day Period
        precipType=weather_codeObj.DayDesc;
      } else {
        // Night Period
        precipType=weather_codeObj.NightDesc;
      }
    }
    Weather.forecastPrecip[i] = `${precipChance}% Chance<br/> of ${precipType}`;

    // forecastNarrative is handled by a separate function that builds the narration.
    if (i==0 || i==2) {
      // Day Period
      Weather.forecastNarrative[i] = buildNarrative(forecastData,(2*i+1),"DAY");
    } else {
      // Night Period
      Weather.forecastNarrative[i] = buildNarrative(forecastData,(2*i+1),"NIGHT");
    }
    // Format the narration with expanded terms for speech.
    Weather.forecastSpeech[i] = VFormat(Weather.forecastNarrative[i]);
  }

  // 7-day outlook logic.

  for (let i = 0; i < 7; i++) {
    // Calculate min and max temperatures over the current day.
    let minTemp=forecastData.temperature_2m[i*4];
    let maxTemp=minTemp;
    for (let di = 1; di < 4; di++) {
      const tTemp=forecastData.temperature_2m[i*4+di];
      if (tTemp>maxTemp) { maxTemp=tTemp;}
      if (tTemp<minTemp) { minTemp=tTemp;}
    }
    Weather.outlookHigh[i] = Math.round(maxTemp);
    Weather.outlookLow[i] = Math.round(minTemp);

    // The weather_code is derived from comparing the code for the 4-reporting times per day.
    // The trailing night code (index 0) is excluded so that there are fewer ties.
    // Preponderance, dominant code is used.
    // If all 3 periods report a different code, use the code with the highest value.
    const wcMap= new Map();
    for (let di = 1; di < 4; di++) {
      const wcVal=forecastData.weather_code[i*4+di];
      wcMap.set(wcVal,(wcMap.get(wcVal) ?? 0)+1);
    }
    const wcMapArr=Array.from(wcMap).sort((a,b) => b[1]-a[1]);
    let wcBestCode=wcMapArr[0][0];
    if (wcMapArr[0][1]==1) {
      // Case where 3 unique codes are returned. Select the largest weather code.
      wcBestCode=Math.max(...wcMap.keys());
    }
    // Modifier, if code is 0 then look at cloud cover for the 2 day periods averaged together.
    // CC>25 change code from 0 to 1. CC>50 change code from 0 to 2.
    if (wcBestCode==0) {
      const cloudCover=(forecastData.cloud_cover[i*4+1]+forecastData.cloud_cover[i*4+2])/2;
      if (cloudCover>50) {
        wcBestCode=2;
      } else if (cloudCover>25) {
        wcBestCode=1;
      }
    }

    const weather_codeObj = getwmoCode(wcBestCode);

    const activePhrase = weather_codeObj.DayDesc;
    // Split phrases on 2 lines to fit inside the boxes.
    const formattedCondition = activePhrase.split(' ').join('<br/>');

    Weather.outlookCondition[i] = formattedCondition;
    Weather.outlookIcon[i] = weather_codeObj.DayIcon;
  }
}

export async function getWeatherOpenMeteo(p_lat,p_long){
  // Store the latitude & longitude in the module for other internal functions to use.
  latitude=p_lat;
  longitude=p_long;

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

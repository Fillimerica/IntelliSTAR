// This is the WeatherFetching module that uses a combination of free weather API
// providers to retrieve the forecast and alerts.
// Retrieval of Latitude & Longitude is provided by open-meteo.com. (No key)
// Retrieval of current and forecast conditions is provided by configured providers.


// import the global configuration
import {globalConfig} from '../common_configuration.js';

// Forecast Providers
import { getWeatherTWC } from "./WeatherFetching_TWC.js";

// Radar Providers
// Custom Radar Handler RainView.
import { getRadarLeafletRainViewer } from "./RadarLeafletRV.js";
// Custom Radar Handler Iowa State Mesonet.
import { getRadarLeafletIEM } from "./RadarLeafletIEM.js";
// Custom Radar Handler Aeris/XWeather.
import { getRadarLeafletXW } from "./RadarLeafletXW.js";
// Custom Radar Handler Rainbow.AI.
import { getRadarLeafletRBAI } from "./RadarLeafletRBAI.js";

// After all the weather data has been retrieved, start the Local on the 8's playback.
import { scheduleTimeline } from "./MainScript.js";

// A note on how this module is designed.
// Most of the weather data is fetch asynchronously and takes varying amounts of time
// to be returned. Only after a particular weather data element is retrieved, the next element
// is requested. The final elements are the radar pages. 
// After all of the weather data has been obtained, then the main playback scheduler located
// in MainScript.js is called.

// Module level variables.
var longitude;
var latitude;

const locationProvider="https://geocoding-api.open-meteo.com/v1/search?count=1&name="

export async function fetchCurrentWeather(){

  // Main function for obtaining the weather data.
  // This function converts the zip or airport code or location into latitude & longitude using 
  // the free API at open-meteo.com.
  // Then the appropriate forecast data provider module is called to retrieve the current
  // and forecast conditions.
  // Then the appropriate radar provider is called to retrieve the radar loop for the area.
  // Finally scheduleTimeline in Mainscript is called to start playback.

  // Define a function level variable to determine if all data was retrieved from the
  // configured service providers.
  var allDataReceived=true;

  // Obtain the latitude & longitude of the location provided.
  const url = locationProvider + locForecast;

  // Call the open-meteo geocoding Server
  const response = await fetch(url, {
    method: 'GET'
  });

  if (!response.ok) {
    console.log("Open-Meteo geocoding response not ok. status=",response.status);
    allDataReceived=false;
  }

  // Only proceed if requests completed successfully.
  if (!allDataReceived) { return false }

  // The API returns a JSON string.
  const locJSON = await response.json();

  // See if the JSON object has a valid data payload
  if (!("results" in locJSON)) {
    // Open-Meteo could not find the location that was entered. 
    // Notify user on-screen and return.
    const eText= getElement("weatherfetch-text").innerHTML + `<br\><br\> <span style="color: #991616;">ERROR! Location can not be found.<br\>Playback halted.</span>`;
    getElement("weatherfetch-text").innerHTML = eText;
    return false;
  }

  // Store the returned values as per the open-meteo API
  longitude=locJSON.results[0].longitude;
  latitude=locJSON.results[0].latitude;
  cityName=locJSON.results[0].name;

  const countryCode=locJSON.results[0].country_code;

  // If the result is valid set the weather and radar data providers.
  if(countryCode==="US") {
    // ICAO code starts with K, set US Radar Provider
    CONFIG.radarSource = globalConfig.radar.ProviderUS;
    CONFIG.radarAPIKey = globalConfig.radar.APIKeyUS;
    CONFIG.forecastSource = globalConfig.forecast.ProviderUS;
    CONFIG.forecastAPIKey = globalConfig.forecast.APIKeyUS;
  } else {
    // ICAO code does not start with K, set WW Radar Provider
    CONFIG.radarSource = globalConfig.radar.ProviderWW;
    CONFIG.radarAPIKey = globalConfig.radar.APIKeyWW;
    CONFIG.forecastSource = globalConfig.forecast.ProviderWW;
    CONFIG.forecastAPIKey = globalConfig.forecast.APIKeyWW;
  }

  // Call the specific forecast provider.
  switch (CONFIG.forecastSource) {
    case "twc":
      allDataReceived=await getWeatherTWC(latitude,longitude);
      break;
    case "nws":
      allDataReceived=getWeather(latitude,longitude);
      break;
    case "xweather":
      allDataReceived=getWeather(latitude,longitude);
      break;
    default:
      console.log("Unknown forecast provider. No forecast data retrieved. forecastSource=",CONFIG.forecastSource);
      allDataReceived=false;
      break;
  }
  console.log("After getWeatherTWC function call");

  // Only proceed if requests completed successfully.
  if (!allDataReceived) { return false }

  // Call the configured radar provider.
  fetchRadarImages();

  // Radar is the last in a string of weather elements to obtain.
  // After all the weather data is obtained, start the visual playback sequence.
  scheduleTimeline(); // Start the Local on the 8's main sequencer.

}

function fetchRadarImages(){
  // This is now a routing function. There are specific function calls for each radar service.
  switch (CONFIG.radarSource) {
    case "direct-nws":
      getRadarDirectNWS();
      break;
    case "leaflet-iowastate":
      getRadarLeafletIEM(latitude,longitude);
      break;
    case "leaflet-rainviewer":
      getRadarLeafletRainViewer(latitude,longitude);
      break;
    case "leaflet-xweather":
      getRadarLeafletXW(latitude,longitude,CONFIG.radarAPIKey);
      break;
    case "leaflet-rainbowai":
      getRadarLeafletRBAI(latitude,longitude);
      break;
    default:
      console.log("Unknown Radar Service! No Radar retrieved. radarSource=",CONFIG.radarSource);
      break;
  }

}

function getRadarDirectNWS(){  
  var mapSettings;

  Weather.radarImage = document.createElement("iframe");
  Weather.radarImage.onerror = function () {
    getElement('radar-container').style.display = 'none';
  }

  mapSettings = btoa(JSON.stringify({
    "agenda": {
      "id": "weather",
      "center": [longitude, latitude],
      "location": null,
      "zoom": 8
    },
    "animating": true,
    "base": "standard",
    "artcc": false,
    "county": false,
    "cwa": false,
    "rfc": false,
    "state": false,
    "menu": false,
    "shortFusedOnly": false,
    "opacity": {
      "alerts": 0.0,
      "local": 0.0,
      "localStations": 0.0,
      "national": 0.6
    }
  }));
  Weather.radarImage.setAttribute("src", "https://radar.weather.gov/?settings=v1_" + mapSettings);
  Weather.radarImage.style.width = "100%"
  // What is going on here is that the standard NWS presentation contains a banner across the top of the frame.
  // This 56px banner is shifted up out of view and the total height is adjusted to compensate.
  Weather.radarImage.style.height = "calc(100% + 56px)"
  Weather.radarImage.style.marginTop = "-56px"
  Weather.radarImage.style.overflow = "hidden"

  if(Weather.alertsActive == -1) {
    console.log("TIMING ERROR!! In radar page acquisition and alert status is undefined!");
  }
  
  if(Weather.alertsActive> 0){
    Weather.zoomedRadarImage = document.createElement("iframe");
    Weather.zoomedRadarImage.onerror = function () {
      getElement('zoomed-radar-container').style.display = 'none';
    }
  
    mapSettings = btoa(JSON.stringify({
      "agenda": {
        "id": "weather",
        "center": [longitude, latitude],
        "location": null,
        "zoom": 10
      },
      "animating": true,
      "base": "standard",
      "artcc": false,
      "county": false,
      "cwa": false,
      "rfc": false,
      "state": false,
      "menu": false,
      "shortFusedOnly": false,
      "opacity": {
        "alerts": 0.0,
        "local": 0.0,
        "localStations": 0.0,
        "national": 0.6
      }
    }));
    Weather.zoomedRadarImage.setAttribute("src", "https://radar.weather.gov/?settings=v1_" + mapSettings);
    Weather.zoomedRadarImage.style.width = "100%"
  // What is going on here is that the standard NWS presentation contains a banner across the top of the frame.
  // This 56px banner is shifted up out of view and the total height is adjusted to compensate.
    Weather.zoomedRadarImage.style.height = "calc(100% + 56px)"
    Weather.zoomedRadarImage.style.marginTop = "-56px"
    Weather.zoomedRadarImage.style.overflow = "hidden"
  }
}

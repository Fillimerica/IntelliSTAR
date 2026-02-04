function fetchAlerts(){
  var alertCrawl = "";
  var alertCSec = "";

  // Only fetch alerts if the global setting allows, 
  // otherwise just fetch the forecast.

  if(CONFIG.alertsEnabled) {
    fetch(`https://api.weather.gov/alerts/active?point=${latitude},${longitude}`)
      .then(function(response) {
          if (response.status !== 200) {
              console.warn("Alerts Error, no alerts will be shown");
          }
        response.json().then(function(data) {
          if (data.features !== undefined) {
            for(var i = 0; i < data.features.length; i++) {
              // Initialize a new AlertObj object for each alert.
              alerts[i] = new AlertObj;
              alerts[i].duration = 5000; // default minimum display duration (used if not narrating)
              alerts[i].dispText = AlertFormat("<b>"+data.features[i].properties.event + ".</b><br>" + data.features[i].properties.description).replace(/\n/g," ");
              // Set the crawl to be a constant string with all the newlines removed.
              alertCSec = AlertFormat(data.features[i].properties.event + "." + data.features[i].properties.description).replace(/\n/g," ");
              // define the spoken alert text with expanded terms so the pronunciation is correct.
              alerts[i].speechText=VFormat(alertCSec);
              alertCrawl = alertCrawl + " " + alertCSec;
            }
            if(alertCrawl != ""){
              CONFIG.crawl = alertCrawl;
            }
            alertsActive = data.features.length;
          } else {
            alertsActive = 0 ; // No active alerts returned.
          }
          fetchForecast(); // continue getting weather data only after response is received and processed.
        });
      })
  } else {
    alertsActive = 0; // no alerts since alerts are disabled.
    fetchForecast();
  }
}

function KVReplace(SString,KeyPairs) {
// This function performs a bulk replacement on a string using a set of key value pairs and resturns the resulting string. 

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
// This function replaces weather abbreviations in the narritive with the full words to allow spoken voice.
//Wind
  const WindDir = {" N ":" north "," NNE ":" north north east "," NE ":" north east "," NNW ":" north north west "," NW ":" north west ",
                 " E ":" east "," ENE ":" east north east "," ESE ":" east south east ",
                 " S ":" south "," SSE ":" south south east "," SE ":" south east "," SSW ":" south south west "," SW ":" south west ",
                 " W ":" west "," WNW ":" west north west "," WSW ":" west south west "};
//Time Zones
  const TimeZone = {" EST ":" eastern standard time "," CST ":" central standard time "," MST ":" mountain standard time "," PST ":" pacific standard time "," HST ":" Hawaii standard time "};
//Fractional Distances
  const FracDist = {" 1/4 ":" a quarter "," 1/2 ":" a half "," 3/4 ":" three quarters of a "};

  RawNarrative = KVReplace(RawNarrative,WindDir);
  RawNarrative = KVReplace(RawNarrative,TimeZone);
  RawNarrative = KVReplace(RawNarrative,FracDist);

  RawNarrative = RawNarrative.replace(/(\d+)F/gi," $1 degrees.");
  RawNarrative = RawNarrative.replace(/mph/gi,"miles per hour");

  RawNarrative = RawNarrative.replace(/(\d+)C/gi," $1 celsius.");
  RawNarrative = RawNarrative.replace(/km\/h/gi,"kilometers per hour");
return RawNarrative;
}

function fetchForecast(){
  fetch(`https://api.weather.com/v1/geocode/${latitude}/${longitude}/forecast/daily/10day.json?language=${CONFIG.language}&units=${CONFIG.units}&apiKey=${globalConfig.general.twcAPIKey}`)
    .then(function(response) {
      if (response.status !== 200) {
        console.log('forecast request error');
        return;
      }
      response.json().then(function(data) {
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
          forecastTemp[i] = n.temp
          forecastIcon[i] = n.icon_code
          forecastNarrative[i] = VFormat(n.narrative)
          forecastPrecip[i] = `${n.pop}% Chance<br/> of ${n.precip_type.charAt(0).toUpperCase() + n.precip_type.substr(1).toLowerCase()}`
        }
        // 7 day outlook
        // TF Adjust 7-day start whether using the day or night forecast start. isDay controls.
        var outlookStart;
        if(isDay) {outlookStart = 0} else {outlookStart = 1};
        for (var i = 0; i < 7; i++) {
          let fc = forecasts[i+outlookStart];
          outlookHigh[i] = fc.max_temp
          outlookLow[i] = fc.min_temp
          outlookCondition[i] = (fc.day ? fc.day : fc.night).phrase_32char.split(' ').join('<br/>')
          // thunderstorm doesn't fit in the 7 day outlook boxes
          // so I multilined it similar to that of the original
          outlookCondition[i] = outlookCondition[i].replace("Thunderstorm", "Thunder</br>storm");
          outlookIcon[i] = (fc.day ? fc.day : fc.night).icon_code
        }
        fetchRadarImages();
      })
    })
}

function fetchCurrentWeather(){

  //Let's check what we're dealing with
  let location = "";
  console.log(CONFIG.locationMode)
  if(CONFIG.locationMode=="POSTAL") {location=`postalKey=${zipCode}:${CONFIG.countryCode}`}
  else if (CONFIG.locationMode=="AIRPORT") {
    //Determine whether this is an IATA or ICAO code
    let airportCodeLength=airportCode.length;
    if(airportCodeLength==3){location=`iataCode=${airportCode}`}
    else if (airportCodeLength==4){location=`icaoCode=${airportCode}`}
    else {
      alert("Please enter a valid ICAO or IATA Code")
      console.error(`Expected Airport Code Lenght to be 3 or 4 but was ${airportCodeLength}`)
      return;
    }
  }
  else {
    alert("Please select a location type");
    console.error("Unknown what to use for location")
    return;
  }
  

  fetch(`https://api.weather.com/v3/location/point?${location}&language=${CONFIG.language}&format=json&apiKey=${globalConfig.general.twcAPIKey}`)
      .then(function (response) {
          if (response.status == 404) {
              alert("Location not found!")
              console.log('conditions request error');
              return;
          }
          if (response.status !== 200) {
              alert("Something went wrong (check the console)")
              console.log('conditions request error');
              return;
          }
      response.json().then(function(data) {
        try {
          // which LOCALE?!
          //Not sure about the acuracy of this. Remove this if necessary
          if(CONFIG.locationMode=="AIRPORT"){
            cityName = data.location.airportName
            .toUpperCase() //Airport names are long
            .replace("INTERNATIONAL","") //If a city name is too long, info bar breaks
            //.replace("AIRPORT","") //This is an attempt to fix it
            .trim();
            console.log(cityName);
          } else {
            //Shouldn't City Name be the field City Name, not Display Name?
            cityName = data.location.city.toUpperCase();
          }
          latitude = data.location.latitude;
          longitude = data.location.longitude;
        } catch (err) {
          alert('Enter valid ZIP code');
          console.error(err)
          getZipCodeFromUser();
          return;
        }
        fetch(`https://api.weather.com/v1/geocode/${latitude}/${longitude}/observations/current.json?language=${CONFIG.language}&units=${CONFIG.units}&apiKey=${globalConfig.general.twcAPIKey}`)
          .then(function(response) {
            if (response.status !== 200) {
              console.log("conditions request error");
              return;
            }
            response.json().then(function(data) {
              // cityName is set in the above fetch call and not this one
              let unit = data.observation[CONFIG.unitField];
              currentTemperature = Math.round(unit.temp);
              currentCondition = data.observation.phrase_32char;
              windSpeed = `${data.observation.wdir_cardinal} ${unit.wspd} ${CONFIG.units === 'm' ? 'km/h' : 'mph'}`;
              gusts = unit.gust || 'NONE';
              feelsLike = unit.feels_like
              visibility = Math.round(unit.vis)
              humidity = unit.rh
              dewPoint = unit.dewpt
              pressure = unit.altimeter.toPrecision(4);
              let ptendCode = data.observation.ptend_code
              pressureTrend = (ptendCode == 1 || ptendCode == 3) ? '▲' : ptendCode == 0 ? '' : '▼'; // if ptendCode == 1 or 3 (rising/rising rapidly) up arrow else its steady then nothing else (falling (rapidly)) down arrow
              currentIcon = data.observation.icon_code
              fetchAlerts();
            });
          });
      })
    });


}

function fetchRadarImages(){
  radarImage = document.createElement("iframe");
  radarImage.onerror = function () {
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
  radarImage.setAttribute("src", "https://radar.weather.gov/?settings=v1_" + mapSettings);
  radarImage.style.width = "1230px"
  radarImage.style.height = "740px"
  radarImage.style.marginTop = "-220px"
  radarImage.style.overflow = "hidden"

  if(alertsActive == -1) {
    console.log("TIMING ERROR!! In radar page aquisition and alert status is undefined!");
  }
  
  if(alertsActive> 0){
    zoomedRadarImage = new Image();
    zoomedRadarImage.onerror = function () {
      getElement('zoomed-radar-container').style.display = 'none';
    }

    zoomedRadarImage = document.createElement("iframe");
    zoomedRadarImage.onerror = function () {
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
    zoomedRadarImage.setAttribute("src", "https://radar.weather.gov/?settings=v1_" + mapSettings);
    zoomedRadarImage.style.width = "1230px"
    zoomedRadarImage.style.height = "740px"
    zoomedRadarImage.style.marginTop = "-220px"
    zoomedRadarImage.style.overflow = "hidden"
  }

  scheduleTimeline();
}

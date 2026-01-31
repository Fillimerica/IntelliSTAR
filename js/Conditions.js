var zipCode;
var airportCode;
var cityName;

var longitude;
var latitude;

var currentTemperature;
var currentIcon;
var currentCondition;
var windSpeed;
var gusts;
var feelsLike;
var visibility;
var humidity;
var dewPoint;
var pressure;
var pressureTrend;
var forecastNarrative = [];
var forecastTemp = [];
var forecastIcon = [];
var forecastPrecip = [];
var outlookHigh = [];
var outlookLow = [];
var outlookCondition = [];
var outlookIcon = [];
var radarImage;
var zoomedRadarImage;

// Extending the Alrts to handle speech translation, length and URL pointers to cached speech data.
var alertsActive = -1; // -1 alert data not returned, 0 no alerts, 1 single alert, >1 multiple alerts.
var alerts = [];
function AlertObj(dispText,speechText,URL,duration) {
  this.dispText = dispText;
  this.speechText = speechText;
  this.URL = URL;
  this.duration = duration;
}


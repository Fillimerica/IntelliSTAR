// This file contains key:value tables and helper functions to convert Weather Data
// from raw values to common values that can be used in the forecast.

// Wind Direction
export function windNumToCardinal(wDir) {
  // This function converts a numeric wind direction into its cardinal name value
  const directions = [
    "N", "NNE", "NE", "ENE",
    "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW",
    "W", "WNW", "NW", "NNW"
  ];

  // Normalize negative or >360 values, shift by half a sector (11.25°), and find index
  const normalized = ((wDir % 360) + 360) % 360;
  const index = Math.floor((normalized + 11.25) / 22.5) % 16;

  return directions[index];
}

// Average wind direction given two directions.
export function avgWindDir(deg1, deg2) {
  const toRad = d => (d * Math.PI) / 180;
  const toDeg = r => (r * 180) / Math.PI;
  const x = (Math.sin(toRad(deg1)) + Math.sin(toRad(deg2))) / 2;
  const y = (Math.cos(toRad(deg1)) + Math.cos(toRad(deg2))) / 2;
  if (Math.hypot(x, y) < 1e-12) return null; // Opposing vectors cancel out
  return ((toDeg(Math.atan2(x, y)) % 360) + 360) % 360;
}

// Temperature conversion
export function tempCtoF(tempC) {
  return (tempC * 1.8 + 32)
}
export function tempFtoC(tempF) {
  return ((tempF - 32) * 0.55555)
}

// Barometric Pressure Conversions hPa to inHg
export function baroPressureInHg(pressure_hPa) {
  return (pressure_hPa * 0.02953)
}

// Speed/distance  KM to Miles
export function KMtoMiles(unitKM) {
  return (unitKM * 0.621371)
}

// Visibility in feet to miles Conversion to 2 decimals
export function ftToMiles(distFeet) {
  return Math.round(distFeet/5280*100)/100  //Return a number rounded to 2 decimal places.
}

// Current hour 0-23 for a given timeZone.
export function getLocalHour(timeZone) {
  const timeHour = new Intl.DateTimeFormat("en-US", {timeZone: timeZone, hour: "numeric", hourCycle: "h23"}).format(new Date());
  return Number(timeHour);
}

// These functions handle phraseology expansion for the spoken narration .
function KVReplace(SString,KeyPairs) {
// This function performs a bulk replacement on a string using a set of key value pairs and returns the resulting string. 

  Object.entries(KeyPairs).forEach(([key, value]) => {
   SString = SString.replaceAll(key,value);
  });

return SString;
}

export function AlertFormat(RawNarrative) {
// This function removes some of the key terms from the narrative to display a more natural readability.
  var KeyTerms = {"* WHAT...":" ","* WHERE...":"Location ","* WHEN...":"Lasting ","* IMPACTS...":" ","* ADDITIONAL DETAILS...":" "};

return KVReplace(RawNarrative,KeyTerms);
}

export function VFormat(RawNarrative) {
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

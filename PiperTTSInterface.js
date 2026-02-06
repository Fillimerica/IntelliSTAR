// import the global configuration
import {globalConfig} from './common_configuration.js';

// Determine the correct PiperTTS voice client configuration and set url
// for the web server to use (if configured).
export async function GetVoiceURL() {
  let endpoint;
  let voiceURL="";
  let voiceOrder=0;
  let voicelist;

  // Look through all the valid endpoints looking for an enabled one that functions
  // and is Server-side. (ignoring any client-side)
  for (let pri = 1; pri <= globalConfig.PiperTTS.endpoints.length; pri++) {
    endpoint = globalConfig.PiperTTS.endpoints.find(endpoint => endpoint.order === pri && endpoint.type === "Server");
    if(endpoint !== undefined) {
      // Found a potential candidate. Test it.
      voiceURL = endpoint.url;

      // Try obtaining the voice list from the proposed URL. For testing only need to
      // verify that data was returnable.
      try {
        console.log("GetVoiceURL Trying Target:",voiceURL);
        const response = await fetch(voiceURL+"/voices", {method: 'GET'});
        console.log("GetVoiceURL resp=",response.status);
        if (!response.ok) {
          throw new Error("GetVoiceURL: response status:"+response.status);
        }

        // now try to get the data from the request
        voicelist = await response.json();

        if(voicelist.ERROR != undefined) {
          throw new Error("GetVoiceURL: VoiceList Data Error");
        }

      } catch (error) {
        // Error from selected endpont. Try the next endpoint.
        continue;
      }
      // Got here means response.ok, so found a valid endpoint. return it.
      voiceOrder = endpoint.order;
      break; // exit for loop
    }

  }

  return { 
    url: voiceURL,
    order: voiceOrder,
  };
}

// Handle querying the Pipertts server for the currently installed voices.
 export async function GetTTSVoices(ttsURL) {

  var voicelist;

  try {

    const response = await fetch(ttsURL+"/voices", {method: 'GET'});
    console.log("resp=",response.status);

    if (!response.ok) {
      throw new Error("GetTTSVoices: response status:"+response.status);
    }
  

    // The server resturns a JSON data object that contains the installed voice data.
    // Note: Async functions always return promises, not the data, so the caller also
    // needs to await or wrap in a .then function to get the final data.

    voicelist = await response.json();

 
  } catch (error) {
    console.error("GetTTSVoices Error=",error.message);
    voicelist=JSON.parse('{"ERROR":"'+error.message+'"}');
  }
  return voicelist;
}

export async function GetSpeech(ttsURL,SpeechStr,voiceSelect) {
// This function retrieves the audio speech blob from the configured tts Server

  // Call the PiperTTS voice server to synthesize the voice.
  const response = await fetch(ttsURL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ text: SpeechStr, voice: voiceSelect }),
  });

  if (!response.ok) {
    console.log("response status:"+response.status);
    if (!response.ok) {
      console.log("response still not ok");
    }
    throw new Error('tts Server Response was not ok');
  }

  // The API returns an audio file (e.g., WAV/OPUS binary data)
  
  const audioBlob = await response.blob();
  return audioBlob;
}

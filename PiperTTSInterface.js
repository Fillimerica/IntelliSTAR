// Handle querying the Pipertts server for the currently installed voices.
GetTTSVoices = async function(ttsURL) {

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

GetSpeech = async function(ttsURL,SpeechStr,voiceSelect) {
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

module.exports = {
  GetTTSVoices, GetSpeech
};
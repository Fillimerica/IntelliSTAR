const express = require('express'); //
const { Readable } = require('node:stream');
const app = express();
const port = 3000;

const piperTTS = require('./PiperTTSInterface.js');

// The target internal server URL
const INTERNAL_PIPERTTS_SERVER = 'http://fillimanpvr:7701'; 

// Main IntelliSTAR Web Server
app.use(express.static('.'));

// Parse incoming requests with JSON payloads
app.use(express.json());

// Define an API endpoint (a route) that calls the Piper TTS function to get installed voices.
app.get('/pipertts/voices', async (req, res) => {
    console.log("SS Endpoint pipertts/voices. Reqpath="+req.path);
    const result = await piperTTS.GetTTSVoices(INTERNAL_PIPERTTS_SERVER);
    res.status(200).json(result); // Send the result back as JSON
});

// Define an API endpoint (a route) that calls the Piper TTS function to return Speech data.
app.post('/pipertts/speech', async (req, res) => {
    console.log("SS Endpoint pipertts/speech. Reqpath="+req.path);
    const spStr = req.body.text;
    const voiceSel = req.body.voice;
    console.log("Speaking. Voice=",voiceSel," Text=",spStr);
    const result = await piperTTS.GetSpeech(INTERNAL_PIPERTTS_SERVER,spStr,voiceSel);

    // result should be a blob containing voice speech in audio/wav format.
    // return this encoded data back to the caller.
    const src = Readable.fromWeb(result.stream());
    res.header('Content-Type','audio/wav');
    res.header('Content-Length',result.size);
    src.pipe(res);
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`); //
});

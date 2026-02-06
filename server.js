//const express = require('express'); //
//const { Readable } = require('node:stream');
import express from 'express';
import {Readable} from 'node:stream';
const app = express();
const port = 3000;

import {globalConfig} from './common_configuration.js';
import * as piperTTS from './PiperTTSInterface.js';

// The target internal server URL
const {url: INT_TTS_SERVER, order: INT_TTS_ORDER } = await piperTTS.GetVoiceURL();
if(INT_TTS_ORDER === 0) {
    console.log("Server Side Piper TTS Server not enabled.");
} else {
    console.log(`Server Side Piper TTS Server is available. Order#${INT_TTS_ORDER}. Server URL:${INT_TTS_SERVER}`);
}

// Main IntelliSTAR Web Server
app.use(express.static('.'));

// Parse incoming requests with JSON payloads
app.use(express.json());

// Define an API endpoint (a route) that calls the Piper TTS function to get installed voices.
app.get('/pipertts/voices', async (req, res) => {
    console.log("SS Endpoint pipertts/voices. Reqpath="+req.path);
    const result = await piperTTS.GetTTSVoices(INT_TTS_SERVER);
    res.status(200).json(result); // Send the result back as JSON
});

// Define an API endpoint (a route) that calls the Piper TTS function to return Speech data.
app.post('/pipertts/speech', async (req, res) => {
    console.log("SS Endpoint pipertts/speech. Reqpath="+req.path);
    const spStr = req.body.text;
    const voiceSel = req.body.voice;
    console.log("Speaking. Voice=",voiceSel," Text=",spStr);
    const result = await piperTTS.GetSpeech(INT_TTS_SERVER,spStr,voiceSel);

    // result should be a blob containing voice speech in audio/wav format.
    // return this encoded data back to the caller.
    const src = Readable.fromWeb(result.stream());
    res.header('Content-Type','audio/wav');
    res.header('Content-Length',result.size);
    src.pipe(res);
});

app.listen(port, () => {
    console.log(`Local on the 8's Server running on http://localhost:${port}`); //
});

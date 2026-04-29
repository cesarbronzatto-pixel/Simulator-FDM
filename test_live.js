import { GoogleGenAI, Modality } from "@google/genai";
import * as dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  const sessionPromise = ai.live.connect({
    model: "gemini-3.1-flash-live-preview",
    config: {
      systemInstruction: "Hello",
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
    },
    callbacks: {
       onopen: () => {
           console.log("OPENED");
       },
       onmessage: (msg) => {
           console.log("MSG", Object.keys(msg), msg.serverContent ? Object.keys(msg.serverContent) : "");
           if (msg.setupComplete || msg.serverContent?.setupComplete) {
               console.log("GOT SETUP COMPLETE! Sending message!");
               sessionPromise.then(s => {
                   if (s.conn && typeof s.conn.send === 'function') {
                       s.conn.send(JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text: "say hello in voice" }] }], turnComplete: true } }));
                   } else {
                       console.log("NO CONN SEND");
                   }
               });
           }
           if (msg.serverContent?.modelTurn) {
               console.log("modelTurn:", JSON.stringify(msg.serverContent.modelTurn, null, 2).substring(0, 500));
           }
       },
       onerror: (e) => {
           console.log("ERR", e);
       },
       onclose: () => {
           console.log("CLOSED");
       }
    }
  });
  await sessionPromise;

  setTimeout(() => {
    console.log("Test finished.");
    process.exit(0);
  }, 5000);
}
test().catch(console.error);

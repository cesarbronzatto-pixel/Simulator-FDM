import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Persona } from '../types';

export function useLiveSession(persona: Persona | null, userName: string, onTranscript?: (text: string) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'model', content: string, finished?: boolean, inProgressContent?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  const setupCompleteRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);

  const startRecording = useCallback(() => {
     if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
         audioCtxRef.current.resume();
     }
     setIsRecording(true);
     isRecordingRef.current = true;
     if (recognitionRef.current) {
         recognitionRef.current.start();
     }
  }, []);

  const stopRecording = useCallback(() => {
     setIsRecording(false);
     isRecordingRef.current = false;
     if (recognitionRef.current) {
         recognitionRef.current.stop();
     }
  }, []);

  // We need to return these.
  const playbackNextTimeRef = useRef(0);
  const aiRef = useRef(new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' }));

  // Helper to play received audio buffer
  const playAudioChunk = useCallback((base64: string) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    
    // Decode base64 to Float32
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768; 
    }

    const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    
    if (playbackNextTimeRef.current < ctx.currentTime) {
      playbackNextTimeRef.current = ctx.currentTime;
    }
    source.start(playbackNextTimeRef.current);
    playbackNextTimeRef.current += audioBuffer.duration;
  }, []);

  const connect = useCallback(async () => {
    if (!persona) return;
    
    try {
      setError(null);
      setupCompleteRef.current = false;
      
      const BaseContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new BaseContext({ sampleRate: 24000 }); // We need 24000 for output
      ctx.resume().catch(e => console.warn("AudioContext resume failed:", e));
      audioCtxRef.current = ctx;
      playbackNextTimeRef.current = ctx.currentTime;

      const systemInstruction = `Você é um Simulador de Clientes de alto nível do Setor Público Brasileiro para treinamento do produto FDM da Xertica.ai.
Nome do Vendedor: ${userName}. 
Você está atuando como: ${persona.name}, ${persona.role}. ${persona.description}. Foco: ${persona.focus}. Dificuldade: ${persona.difficulty}.
SEJA CONCISO EM SUAS RESPOSTAS, VOCÊ ESTÁ EM UMA CONVERSA DE VOZ NATURAL.`;

      const sessionPromise = aiRef.current.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          systemInstruction,
          responseModalities: [Modality.AUDIO],
          speechConfig: {
             voiceConfig: { prebuiltVoiceConfig: { voiceName: persona?.gender === 'Feminino' ? 'Kore' : 'Puck' } },
          }
        },
        callbacks: {
          onopen: async () => {
            setIsConnected(true);
            try {
              const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
              if (SpeechRecognition) {
                  const recognition = new SpeechRecognition();
                  recognition.continuous = true;
                  recognition.interimResults = true;
                  recognition.lang = 'pt-BR';
                  
                  recognition.onresult = (event: any) => {
                      let finalTranscript = '';
                      let interimTranscript = '';
                      for (let i = 0; i < event.results.length; ++i) {
                          if (event.results[i].isFinal) {
                              finalTranscript += event.results[i][0].transcript;
                          } else {
                              interimTranscript += event.results[i][0].transcript;
                          }
                      }
                      
                      if (onTranscript) {
                          onTranscript((finalTranscript + interimTranscript).trim());
                      }
                  };
                  
                  recognition.onerror = (event: any) => {
                      console.error("Speech recognition error:", event.error);
                  };
                  
                  recognitionRef.current = recognition;
              } else {
                  console.warn("SpeechRecognition not supported in this browser.");
              }
            } catch (err) {
              console.error("Initialization error:", err);
              setError("Erro ao inicializar o microfone.");
              setIsConnected(false);
            }
          },
          onmessage: async (message: LiveServerMessage) => {
              console.log("Raw WS Message received, keys:", Object.keys(message));
              if ((message as any).setupComplete) {
                 if (!setupCompleteRef.current) {
                     setupCompleteRef.current = true;
                     console.log("SETUP COMPLETE! Sending initial prompt...");
                     sessionPromise.then(session => {
                        setTimeout(() => {
                           console.log("Sending initial prompt NOW");
                           session.sendClientContent({ 
                               turns: [{ role: 'user', parts: [{ text: `A reunião começou. Inicie a conversa dizendo estritamente esta frase e nada mais: "${persona.initialMessage}"` }] }], 
                               turnComplete: true 
                           });
                        }, 1000);
                     });
                 }
              }

              console.log("Live Message:", message.serverContent);
              
              if (message.serverContent?.modelTurn?.parts) {
                  for (const part of message.serverContent.modelTurn.parts) {
                      if (part.inlineData?.data) {
                          console.log("Playing audio chunk length:", part.inlineData.data.length);
                          playAudioChunk(part.inlineData.data);
                      }
                      if (part.text) {
                          console.log("Model part text:", part.text);
                          setMessages(prev => {
                              const newMessages = [...prev];
                              if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'model' && !newMessages[newMessages.length - 1].finished) {
                                  const lastIdx = newMessages.length - 1;
                                  newMessages[lastIdx] = { ...newMessages[lastIdx], content: newMessages[lastIdx].content + part.text };
                              } else {
                                  newMessages.push({ role: 'model', content: part.text, finished: false });
                              }
                              return newMessages;
                          });
                      }
                  }
              }

              if (message.serverContent?.outputTranscription) {
                  const tx = message.serverContent.outputTranscription;
                  setMessages(prev => {
                      const newMessages = [...prev];
                      let lastModelMsgIdx = -1;
                      for (let i = newMessages.length - 1; i >= 0; i--) {
                          if (newMessages[i].role === 'model' && !newMessages[i].finished) {
                              lastModelMsgIdx = i;
                              break;
                          }
                      }

                      if (tx.text) {
                          if (lastModelMsgIdx !== -1) {
                              newMessages[lastModelMsgIdx] = { 
                                  ...newMessages[lastModelMsgIdx], 
                                  inProgressContent: (newMessages[lastModelMsgIdx].inProgressContent || '') + tx.text 
                              };
                          } else {
                              newMessages.push({ role: 'model', content: '', inProgressContent: tx.text, finished: false });
                              lastModelMsgIdx = newMessages.length - 1;
                          }
                      }

                      if (tx.finished && lastModelMsgIdx !== -1) {
                          const msg = newMessages[lastModelMsgIdx];
                          newMessages[lastModelMsgIdx] = { 
                              ...msg, 
                              content: msg.content + (msg.inProgressContent || '') + ' ', 
                              inProgressContent: '',
                          };
                      }

                      return newMessages;
                  });
              }

              if (message.serverContent?.inputTranscription) {
                  const tx = message.serverContent.inputTranscription;
                  console.log("User inputTranscription:", tx);
                  setMessages(prev => {
                      const newMessages = [...prev];
                      let lastUserMsgIdx = -1;
                      for (let i = newMessages.length - 1; i >= 0; i--) {
                          if (newMessages[i].role === 'user' && !newMessages[i].finished) {
                              lastUserMsgIdx = i;
                              break;
                          }
                      }

                      if (tx.text) {
                          if (lastUserMsgIdx !== -1) {
                              newMessages[lastUserMsgIdx] = { 
                                  ...newMessages[lastUserMsgIdx], 
                                  inProgressContent: (newMessages[lastUserMsgIdx].inProgressContent || '') + tx.text 
                              };
                          } else {
                              newMessages.push({ role: 'user', content: '', inProgressContent: tx.text, finished: false });
                              lastUserMsgIdx = newMessages.length - 1;
                          }
                      }

                      if (tx.finished && lastUserMsgIdx !== -1) {
                          const msg = newMessages[lastUserMsgIdx];
                          newMessages[lastUserMsgIdx] = { 
                              ...msg, 
                              content: msg.content + (msg.inProgressContent || '') + ' ', 
                              inProgressContent: '',
                          };
                      }

                      return newMessages;
                  });
              }

              if (message.serverContent?.turnComplete) {
                  console.log("TURN COMPLETE RECEIVED.");
                  setMessages(prev => {
                      const newMessages = [...prev];
                      let lastModelIdx = -1;
                      for (let i = newMessages.length - 1; i >= 0; i--) {
                          if (newMessages[i].role === 'model' && !newMessages[i].finished) {
                              lastModelIdx = i;
                              break;
                          }
                      }
                      if (lastModelIdx !== -1) {
                          const msg = newMessages[lastModelIdx];
                          newMessages[lastModelIdx] = { 
                              ...msg, 
                              finished: true,
                              content: msg.content + (msg.inProgressContent || ''),
                              inProgressContent: ''
                          };
                      }
                      return newMessages;
                  });
              }

              if (message.serverContent?.interrupted) {
                  playbackNextTimeRef.current = audioCtxRef.current?.currentTime || 0;
              }
          },
          onerror: (e) => {
            console.error("WebSocket Error:", e);
            setError("Erro na conexão WebSocket.");
            disconnect();
          },
          onclose: () => {
             console.log("Session closed");
             disconnect();
          }
        }
      });

      sessionRef.current = sessionPromise;
      // Start the ctx if suspended
      if (ctx.state === 'suspended') {
         await ctx.resume();
      }

    } catch (e: any) {
       console.error("Failed to connect", e);
       setError(e.message || "Failed to initialize Live session.");
    }
  }, [persona, userName, playAudioChunk]);

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
       sessionRef.current.then((s: any) => {
         if (s && typeof s.close === 'function') {
           try { s.close(); } catch(e){}
         }
       }).catch(()=>{});
       sessionRef.current = null;
    }
    if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
    }
    if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch(e){}
        audioCtxRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const sendTextMessage = useCallback((text: string) => {
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
    }
    if (sessionRef.current) {
        sessionRef.current.then((session: any) => {
             session.sendClientContent({ 
                 turns: [{ role: 'user', parts: [{ text }] }], 
                 turnComplete: true 
             });
        });
        setMessages(prev => [...prev, { role: 'user', content: text, finished: true }]);
    }
  }, []);

  return {
     isConnected,
     isRecording,
     connect,
     disconnect,
     startRecording,
     stopRecording,
     error,
     messages,
     sendTextMessage
  };
}

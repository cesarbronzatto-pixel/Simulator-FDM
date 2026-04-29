import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, Send, User, Loader2, Award, CheckCircle2, XCircle, Volume2, VolumeX, Mic, MicOff, Square } from 'lucide-react';
import { Persona, Message, SessionReport } from '../types';
import { chatWithPersona, generateReport, textToSpeech } from '../services/gemini';
import { saveSession } from '../services/firebase';
import { cn } from '../lib/utils';
import confetti from 'canvas-confetti';
import { useLiveSession } from '../hooks/useLiveSession';
import { PERSONAS } from '../data/personas';

interface RoleplayViewProps {
  onComplete: () => void;
  user: any;
}

export default function RoleplayView({ onComplete, user }: RoleplayViewProps) {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'initializing' | 'ready' | 'active' | 'ending' | 'finished'>('initializing');
  const [report, setReport] = useState<SessionReport | null>(null);

  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const initSession = async () => {
    try {
      setErrorStatus(null);
      // Removed LLM/Avatar generation delays
      // Select random persona from database
      const randomPersona = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
      // Optional slight artificial delay to make it feel like "connecting"
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setPersona(randomPersona as Persona);
      setStatus('ready');
    } catch (e) {
      console.error("Failed to init session", e);
      setErrorStatus(e instanceof Error ? e.message : String(e));
    }
  };

  const handleStartVoiceMode = async () => {
      setStatus('active');
      await connect();
  };
  const [turnCount, setTurnCount] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(120);
  const [penalties, setPenalties] = useState(0);
  const [sentiment, setSentiment] = useState('Neutro');
  const preRecordTextRef = useRef('');

  const { isConnected, isRecording, startRecording, stopRecording, connect, disconnect, error: liveError, messages: liveMessages, sendTextMessage } = useLiveSession(persona, user.displayName || 'Vendedor', (text) => {
      const base = preRecordTextRef.current ? preRecordTextRef.current + ' ' : '';
      setInput(base + text);
  });

  const handleStartRecord = () => {
      preRecordTextRef.current = input;
      startRecording();
  };

  const isProcessing = messages.length > 0 && messages[messages.length - 1].role === 'model' && !(messages[messages.length - 1] as any).finished;

  useEffect(() => {
    if (isConnected) {
      setMessages(liveMessages as Message[]);
    }
  }, [liveMessages, isConnected]);

  const hasNudgedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialMessageSentRef = useRef(false);

  const playSound = (type: 'send' | 'receive') => {
    const url = type === 'send' 
      ? 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'
      : 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';
    const audio = new Audio(url);
    audio.volume = 0.4;
    audio.play().catch(e => console.warn("Sound prevented", e));
  };

  useEffect(() => {
    if (!initialMessageSentRef.current) {
      initialMessageSentRef.current = true;
      initSession();
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    setTurnCount(liveMessages.length);
  }, [messages, status]);

  useEffect(() => {
    if (status === 'active' && !isProcessing) {
      timerRef.current = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1 && !hasNudgedRef.current) {
            handleNudge();
            return 120;
          }
          if (prev <= 1 && hasNudgedRef.current) {
            return 1;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, turnCount, messages.length]);

  const handleNudge = () => {
    if (hasNudgedRef.current || status !== 'active') return;
    setPenalties(prev => prev + 1);
    hasNudgedRef.current = true;
    if (isConnected) {
        sendTextMessage("O vendedor demorou muito para responder. Dê um empurrãozinho para ele responder.");
    }
    playSound('receive');
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (isRecording) {
      stopRecording();
    }
    
    const content = input;
    if (!content.trim() || status !== 'active') return;

    setInput('');
    preRecordTextRef.current = '';
    setSecondsRemaining(120);
    hasNudgedRef.current = false;
    playSound('send');

    sendTextMessage(content);

    if (turnCount >= 5) {
      if (!isSavingRef.current) {
        setTimeout(() => {
          handleEndSession(messages);
        }, 1500);
      }
    }
  };

  const isSavingRef = useRef(false);

  const handleEndSession = async (finalMessages: Message[]) => {
    if (isSavingRef.current || status === 'ending' || status === 'finished') return;
    isSavingRef.current = true;
    setStatus('ending');
    try {
      const r = await generateReport(finalMessages, persona!, penalties);
      setReport(r);
      setStatus('finished');
      
      await saveSession({
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName,
        persona: persona!.name,
        score: r.sessao.score_final,
        report: r,
        chatHistory: finalMessages
      });

      if (r.sessao.score_final > 80) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f97316', '#ffffff', '#000000']
        });
      }
    } catch (e) {
      console.error("Failed to generate report", e);
    }
  };

  if (status === 'initializing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full border-4 border-orange-500/20 border-t-orange-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <User className="w-8 h-8 text-orange-500/50" />
          </div>
        </div>
        <div className="text-center">
          <h3 className="text-xl font-bold mb-2">Conectando com o Cliente...</h3>
          <p className="text-white/40 text-sm font-mono">ESTABELECENDO CANAL SEGURO</p>
          {errorStatus && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/50 rounded text-red-500 text-xs">
              <p>Erro: {errorStatus}</p>
              <button 
                onClick={initSession}
                className="mt-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded"
              >
                Tentar Novamente
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === 'ready') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="text-center">
          <h3 className="text-3xl font-bold mb-[15px] pb-0 pr-0 pt-[30px]">Seu Cliente está pronto</h3>
          
          <p className="text-text-secondary text-sm mb-8 max-w-md mx-auto leading-relaxed">
            Prepare-se! Ele(a) entrará na sala agora e você deve conduzir a simulação por voz.
          </p>

          <div className="bg-card-bg border border-border-custom px-8 py-8 rounded-xl mb-6 max-w-sm mx-auto text-center flex flex-col gap-2 shadow-lg">
            <span className="text-2xl font-bold text-accent mb-1">{persona?.name}</span>
            <span className="text-sm text-text-primary/80 mb-6">{persona?.role}</span>
            
            <button
                onClick={handleStartVoiceMode}
                disabled={isConnected}
                className="px-8 py-4 bg-accent text-bg-dark font-bold rounded-xl hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 flex items-center justify-center gap-2 mx-auto w-full"
            >
                <Mic className="w-5 h-5" />
                Entrar na Reunião
            </button>
          </div>
          
          {liveError && <p className="text-red-500 mt-4 text-sm">{liveError}</p>}
        </div>
      </div>
    );
  }

  if (status === 'finished' && report) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-4xl mx-auto bg-card-bg border border-border-custom rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="p-8 border-b border-border-custom bg-gradient-to-r from-accent/10 to-transparent flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Relatório de Performance</h2>
            <p className="text-text-secondary text-sm mt-1">Sessão com {persona?.name} • {persona?.role}</p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-black text-accent">{report.sessao.score_final}</div>
            <div className="text-[10px] font-mono tracking-widest opacity-40 uppercase">Score Final</div>
          </div>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <section>
              <h4 className="card-title">Análise Comercial</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-bg-dark/50 rounded-lg border border-border-custom">
                  <div className="text-[10px] font-bold text-text-secondary mb-2 uppercase">Pontos Fortes</div>
                  <p className="text-sm leading-relaxed">{report.analise_comercial.pontos_fortes}</p>
                </div>
                <div className="p-4 bg-bg-dark/50 rounded-lg border border-border-custom">
                  <div className="text-[10px] font-bold text-text-secondary mb-2 uppercase">A Melhorar</div>
                  <p className="text-sm leading-relaxed">{report.analise_comercial.pontos_a_melhorar}</p>
                </div>
              </div>
            </section>

            <section>
              <h4 className="card-title">Veredito</h4>
              <div className="p-6 bg-accent/5 border border-accent/20 rounded-xl italic text-lg">
                "{report.analise_comercial.veredito}"
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <h4 className="card-title">Checkpoints</h4>
            <div className="space-y-3">
              {[
                { label: 'Pitch Claro', value: report.checkpoints.pitch_claro_e_objetivo },
                { label: 'Segurança nas Objeções', value: report.checkpoints.tratou_objecoes_com_seguranca },
                { label: 'Valor vs Dor', value: report.checkpoints.conectou_valor_a_dor },
                { label: 'Condução p/ Fechamento', value: report.checkpoints.conduziu_para_fechamento },
              ].map((cp, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-bg-dark/50 rounded-lg border border-border-custom">
                  <span className="text-xs font-medium">{cp.label}</span>
                  {cp.value ? <CheckCircle2 className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-red-500" />}
                </div>
              ))}
            </div>

            <button
              onClick={onComplete}
              className="w-full py-4 bg-accent text-bg-dark font-bold rounded-xl hover:bg-accent/90 transition-colors mt-8 shadow-lg shadow-accent/20"
            >
              VOLTAR AO INÍCIO
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row bg-[#020617]">
      {/* Sidebar: Persona Info */}
      <aside className="lg:w-[280px] bg-bg-dark p-6 border-r border-border-custom flex flex-col gap-6 overflow-y-auto">
        <section>
          <div className="card-title" style={{ textAlign: 'center' }}>Sessão Ativa</div>
          <div className="persona-card text-center">
            <div style={{ width: '150px', height: '150px' }} className="rounded-full border-2 border-accent/20 bg-gradient-to-br from-card-bg to-bg-dark overflow-hidden mb-4 shadow-[0_0_15px_rgba(0,0,0,0.5)] mx-auto">
              {persona?.avatarUrl ? (
                <img src={persona.avatarUrl} style={{ width: '150px', height: '150px' }} className="object-cover opacity-80" alt="persona" />
              ) : (
                <div className="text-5xl h-full w-full flex items-center justify-center grayscale opacity-50">👤</div>
              )}
            </div>
            <div className="persona-role text-accent text-lg">{persona?.name}</div>
            <div className="text-xs text-text-secondary mb-3">{persona?.role}</div>
            <div className="flex items-center justify-center gap-2 text-xs text-warning">
              <div className="w-2 h-2 rounded-full bg-warning shadow-[0_0_8px_var(--color-warning)]" />
              {persona?.difficulty === 'Hardcore' ? 'Cético / Defensivo' : 'Aberto / Curioso'}
            </div>
          </div>
        </section>

        <section>
          <div className="card-title" style={{ textAlign: 'center' }}>Métricas da Reunião</div>
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-text-secondary uppercase font-bold">
                <span className="font-mono text-[10px] tracking-wider">DURAÇÃO DA REUNIÃO</span>
                <span className="text-accent" style={{ fontSize: '12px' }}>{Math.min(Math.round((turnCount / 6) * 100), 100)}%</span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-accent"
                  animate={{ width: `${Math.min((turnCount / 6) * 100, 100)}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-text-secondary uppercase font-bold">
                <span className="font-mono text-[10px] tracking-wider">TEMPO DE RESPOSTA</span>
                <span style={{ fontSize: '12px' }} className={cn(secondsRemaining < 30 ? "text-red-500" : "text-accent")}>
                  {Math.floor(secondsRemaining / 60)}:{(secondsRemaining % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  className={cn("h-full", secondsRemaining < 30 ? "bg-red-500" : "bg-accent")}
                  initial={{ width: '100%' }}
                  animate={{ width: `${(secondsRemaining / 120) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-text-secondary font-mono text-[10px] tracking-wider font-bold">SENTIMENTO</span>
              <span style={{ fontSize: '12px' }} className={cn(
                "font-mono transition-colors font-bold uppercase",
                sentiment === 'Irritado' || sentiment === 'Desinteressado' ? 'text-red-500' : 
                sentiment === 'Impressionado' ? 'text-success shadow-[0_0_8px_var(--color-success)]' : 'text-accent'
              )}>{sentiment}</span>
            </div>
          </div>
        </section>

        <section className="mt-auto">
          <div className="ghost-tip">
            <strong>Dica:</strong> Foque na proposta de valor e no pitch do FDM.
          </div>
          {turnCount > 5 && (
            <div className="ghost-tip-alert">
              <strong>Alerta:</strong> O cliente quer ver como o FDM resolve o problema dele na prática.
            </div>
          )}
        </section>
      </aside>

      {/* Main: Meeting Area Container */}
      <section className="flex-1 flex flex-col relative w-full h-[calc(100vh-64px)] overflow-hidden">
        
        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-6 md:p-12 pb-64 space-y-6" ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className={cn(
              "flex flex-col max-w-[85%] sm:max-w-xl",
              m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
            )}>
              <div className="font-bold mb-1 opacity-50 uppercase text-[9px]">
                {m.role === 'user' ? 'Você' : persona?.name}
              </div>
              <div className={cn(
                "p-4 rounded-[20px] text-[13px] leading-relaxed relative group/msg",
                m.role === 'user' ? "bg-accent text-bg-dark rounded-br-sm" : "bg-card-bg border border-border-custom rounded-bl-sm"
              )}>
                {m.content}
                {m.inProgressContent && (
                  <span className={cn(
                    "opacity-70 italic",
                    m.content ? "ml-1" : ""
                  )}>
                    {m.inProgressContent}
                  </span>
                )}
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="mr-auto flex flex-col items-start gap-1 max-w-[85%] sm:max-w-xl">
               <div className="font-bold opacity-50 uppercase text-[9px] pl-2">{persona?.name}</div>
               <div className="p-4 rounded-[20px] rounded-bl-sm bg-card-bg border border-border-custom flex gap-2 items-center">
                 <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                 <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                 <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
               </div>
            </div>
          )}
          <div className="h-10 w-full shrink-0" />
        </div>

        {/* Controls Footer */}
        <footer className="absolute bottom-0 left-0 right-0 p-4 bg-bg-dark/80 backdrop-blur-md border-t border-border-custom z-20">
          <div className="w-full max-w-4xl mx-auto flex items-end gap-3 relative">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={status !== 'active'}
              placeholder={isRecording ? "Gravando áudio... Clique em Finalizar Gravação quando terminar." : "Digite sua mensagem (ou clique em Gravar Voz)..."}
              className="flex-1 min-h-[66.1813px] max-h-[200px] bg-card-bg border border-border-custom rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent disabled:opacity-50 transition-colors resize-none overflow-y-auto"
            />
            {!isRecording ? (
              <button
                type="button"
                onClick={() => handleStartRecord()}
                style={{ height: '66.1813px' }}
                disabled={status !== 'active'}
                className="px-4 shrink-0 bg-card-bg text-text-secondary border border-border-custom cursor-pointer rounded-xl flex items-center gap-2 justify-center disabled:opacity-50 hover:text-accent hover:border-accent hover:bg-accent/5 transition-all"
                title="Gravar Voz"
              >
                <Mic className="w-5 h-5" />
                <span className="hidden sm:inline font-medium">Gravar Voz</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => stopRecording()}
                style={{ height: '66.1813px' }}
                disabled={status !== 'active'}
                className="px-4 shrink-0 bg-green-500 text-bg-dark border-none cursor-pointer rounded-xl flex items-center gap-2 justify-center disabled:opacity-50 hover:bg-green-400 shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all font-bold"
                title="Finalizar Gravação"
              >
                <div className="relative flex items-center justify-center w-5 h-5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40"></span>
                  <Square className="relative w-4 h-4 fill-current text-bg-dark" />
                </div>
                <span className="hidden sm:inline">Finalizar Gravação</span>
              </button>
            )}
            <button
              onClick={() => handleSend()}
              type="button"
              style={{ height: '66.1813px' }}
              disabled={!input.trim() || status !== 'active'}
              className="w-[50px] shrink-0 bg-accent text-bg-dark cursor-pointer rounded-xl flex items-center justify-center disabled:opacity-50 hover:bg-accent/90 transition-all border-none"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => handleEndSession(messages)}
              style={{ height: '66.1813px' }}
              className={cn(
                "px-4 shrink-0 font-bold rounded-xl text-xs transition-all flex items-center gap-2 border",
                turnCount >= 6 
                  ? "bg-success/10 text-success border-success/20 hover:bg-success/20 shadow-[0_0_15px_rgba(34,197,94,0.2)]" 
                  : "bg-red-600/10 text-red-500 border-red-500/20 hover:bg-red-600/20"
              )}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{turnCount >= 6 ? 'CONCLUIR' : 'ENCERRAR'}</span>
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

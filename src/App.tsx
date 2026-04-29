/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { onAuth, loginWithGoogle, isMock, logout } from './services/firebase';
import RoleplayView from './components/RoleplayView';
import AdminView from './components/AdminView';
import { User } from 'firebase/auth';
import { LogIn, Shield, User as UserIcon, PlayCircle, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { isAdmin as checkIsAdmin } from './constants';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'home' | 'roleplay' | 'admin'>('home');
  const [loading, setLoading] = useState(true);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuth((u) => {
      setUser(u as any);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (e) {
      console.error("Login failed", e);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setView('home');
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  const isAdmin = checkIsAdmin(user?.email);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-white font-mono text-sm tracking-widest opacity-50"
        >
          INICIALIZANDO WAR ROOM...
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bg-dark text-text-primary flex flex-col items-center justify-center p-6 font-sans overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/20 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-success/20 blur-[120px] rounded-full" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 text-center max-w-2xl"
        >
          <div className="mb-4 inline-block px-3 py-1 border border-accent/30 rounded-full bg-accent/5 text-accent text-[10px] font-mono tracking-[0.2em] uppercase">
            Xertica.ai Training Module
          </div>
          <h1 className="text-6xl md:text-8xl font-bold tracking-tighter mb-6 bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">
            FDM TRAINER
          </h1>
          <p className="text-text-secondary text-lg mb-12 max-w-lg mx-auto leading-relaxed">
            Aprimore seu pitch sobre o Fair Decision Making em simulações de alta fidelidade com personas do setor público.
          </p>

          <button
            onClick={handleLogin}
            className="group relative px-8 py-4 bg-accent text-bg-dark font-bold rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 flex items-center gap-3 mx-auto"
          >
            <LogIn className="w-5 h-5" />
            <span>ENTRAR COM GOOGLE</span>
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform" />
          </button>

          {isMock && (
            <p className="mt-4 text-xs text-text-secondary font-mono">
              [MODO DE DEMONSTRAÇÃO ATIVO]
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-dark text-text-primary font-sans flex flex-col">
      {/* Header */}
      <nav className="h-[60px] px-6 flex justify-between items-center border-b border-border-custom bg-bg-dark/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {!logoError ? (
              <img 
                src="/logo.png" 
                alt="Xertica.ai" 
                className="h-8 w-auto" 
                onError={() => setLogoError(true)}
              />
            ) : (
              <span className="text-xl font-extrabold tracking-tighter">
                XERTICA<span className="text-accent">.AI</span>
              </span>
            )}
            <span className="text-text-secondary font-light mx-2">|</span>
            <span className="text-xl font-extrabold tracking-tighter uppercase">FDM Trainer</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={() => setView('home')}
            style={{ fontFamily: 'Verdana', fontSize: '14px' }}
            className={cn("font-bold tracking-widest transition-colors hover:text-accent uppercase", view === 'home' ? "text-accent" : "text-text-secondary")}
          >
            HOME
          </button>
          {isAdmin && (
            <button 
              onClick={() => setView('admin')}
              style={{ fontFamily: 'Verdana', fontSize: '14px' }}
              className={cn(
                "px-3 py-1 rounded-full font-bold tracking-widest transition-all uppercase",
                view === 'admin' 
                  ? "bg-accent/20 text-accent border border-accent/30" 
                  : "text-text-secondary hover:text-accent"
              )}
            >
              MODO ADMIN
            </button>
          )}
          <div className="flex items-center gap-3 pl-6 border-l border-border-custom">
            <div className="text-right hidden sm:block">
              <div className="text-[11px] font-bold leading-none">{user.displayName}</div>
              <div className="text-[10px] text-text-secondary leading-none mt-1">{user.email}</div>
            </div>
            <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-border-custom" alt="avatar" />
            <button 
              onClick={handleLogout}
              className="p-2 text-text-secondary hover:text-red-500 transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="flex-1 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center px-6 py-12"
            >
              <div>
                <h2 className="text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
                  Pronto para a <br/><span className="text-accent italic">reunião de negócios?</span>
                </h2>
                <p className="text-text-secondary mb-8 leading-relaxed text-lg">
                  Você será conectado a um cliente aleatório do setor público. 
                  O objetivo é realizar o discovery e apresentar o FDM.
                </p>
                
                <div className="space-y-6 mb-10">
                  <div className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-xl bg-card-bg border border-border-custom flex items-center justify-center shrink-0">
                      <PlayCircle className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold">Simulação por Chat</h4>
                      <p className="text-xs text-text-secondary">Interação natural de texto com IA de última geração.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-xl bg-card-bg border border-border-custom flex items-center justify-center shrink-0">
                      <Shield className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold">Feedback Detalhado</h4>
                      <p className="text-xs text-text-secondary">Relatório de performance e análise comercial após a sessão.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative w-[380px] h-[380px] rounded-3xl overflow-hidden border border-border-custom bg-card-bg group shadow-2xl mx-auto md:ml-auto">
                <img 
                  src="https://picsum.photos/seed/meeting/800/800?blur=5" 
                  className="w-[380px] h-[380px] object-cover opacity-20 group-hover:scale-105 transition-transform duration-1000" 
                  alt="meeting"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full border-4 border-accent/30 flex items-center justify-center mb-6 mx-auto animate-pulse bg-accent/5">
                      <UserIcon className="w-12 h-12 text-accent" />
                    </div>
                    <button
                      onClick={() => setView('roleplay')}
                      className="px-10 py-4 bg-accent text-bg-dark font-bold rounded-xl hover:bg-accent/90 transition-colors flex items-center gap-3 shadow-lg shadow-accent/20"
                    >
                      INICIAR ROLEPLAY
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'roleplay' && (
            <RoleplayView onComplete={() => setView('home')} user={user} />
          )}

          {view === 'admin' && (
            <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-12">
              <AdminView />
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

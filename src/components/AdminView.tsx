import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getHistory, deleteHistoryEntry } from '../services/firebase';
import { HistoryEntry, Message } from '../types';
import { 
  Search, 
  Calendar, 
  User, 
  Award, 
  ChevronRight, 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  MessageSquare, 
  Users,
  Filter,
  ArrowLeft,
  Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function AdminView() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [activeTab, setActiveTab] = useState<'report' | 'chat'>('report');
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const h = await getHistory();
      setHistory(h);
    } catch (e) {
      console.error("Failed to load history", e);
    } finally {
      setLoading(false);
    }
  };

  // Get unique users for the sidebar
  const uniqueUsers = useMemo(() => {
    const usersMap = new Map<string, { email: string; name: string; count: number }>();
    history.forEach(h => {
      if (!usersMap.has(h.userEmail)) {
        usersMap.set(h.userEmail, { email: h.userEmail, name: h.userName, count: 0 });
      }
      usersMap.get(h.userEmail)!.count++;
    });
    return Array.from(usersMap.values()).sort((a, b) => b.count - a.count);
  }, [history]);

  const filteredHistory = history.filter(h => {
    const matchesUser = selectedUserEmail ? h.userEmail === selectedUserEmail : true;
    const matchesSearch = 
      h.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.persona.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesUser && matchesSearch;
  });

  const handleRecordDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Deseja realmente excluir este registro permanentemente?')) return;
    
    try {
      await deleteHistoryEntry(id);
      if (selectedEntry?.id === id) setSelectedEntry(null);
      await loadHistory();
    } catch (error) {
      console.error("Failed to delete", error);
      alert("Erro ao excluir registro. Verifique as permissões.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xs font-mono tracking-widest opacity-40 uppercase">CARREGANDO HISTÓRICO...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] overflow-hidden">
      {/* 1. Sidebar - Users */}
      <aside className="lg:w-64 flex flex-col gap-4 shrink-0 border-r border-border-custom pr-6 overflow-hidden">
        <div className="flex items-center gap-2 px-1 mb-2">
          <Users className="w-4 h-4 text-accent" />
          <h3 className="card-title mb-0">Usuários Ativos</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
          <button
            onClick={() => setSelectedUserEmail(null)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors border",
              selectedUserEmail === null 
                ? "bg-accent/10 border-accent/20 text-accent font-bold" 
                : "bg-transparent border-transparent text-text-secondary hover:bg-white/5"
            )}
          >
            Todos os Usuários ({history.length})
          </button>
          
          {uniqueUsers.map(user => (
            <button
              key={user.email}
              onClick={() => setSelectedUserEmail(user.email)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors border",
                selectedUserEmail === user.email 
                  ? "bg-accent/10 border-accent/20 text-accent font-bold" 
                  : "bg-transparent border-transparent text-text-secondary hover:bg-white/5"
              )}
            >
              <div className="truncate">{user.name}</div>
              <div className="text-[9px] opacity-40 uppercase truncate">{user.count} sessões</div>
            </button>
          ))}
        </div>
      </aside>

      {/* 2. Middle Column - Session List */}
      <div className="lg:w-1/4 flex flex-col gap-4 shrink-0 overflow-hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input 
            type="text"
            placeholder="Buscar sessão..."
            className="w-full bg-card-bg border border-border-custom rounded-xl py-3 pl-10 pr-4 text-xs focus:outline-none focus:border-accent/50 transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
          {filteredHistory.map((entry) => (
            <div
              key={entry.id}
              onClick={() => {
                setSelectedEntry(entry);
                setActiveTab('report');
              }}
              className={cn(
                "w-full text-left p-4 rounded-xl border transition-all group cursor-pointer",
                selectedEntry?.id === entry.id 
                  ? "bg-accent/10 border-accent/30 shadow-lg shadow-accent/5" 
                  : "bg-card-bg border-border-custom hover:border-accent/20"
              )}
            >
              <div className="flex justify-between items-start mb-2 gap-2">
                <div className="text-[9px] font-mono tracking-widest text-text-secondary uppercase">
                  {new Date(entry.date).toLocaleDateString('pt-BR')}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => handleRecordDelete(e, entry.id)}
                    className="p-1 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="Excluir Registro"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <div className={cn(
                    "text-xs font-black",
                    entry.score >= 80 ? "text-success" : entry.score >= 50 ? "text-warning" : "text-red-500"
                  )}>
                    {entry.score}
                  </div>
                </div>
              </div>
              <div className="font-bold text-xs mb-1 group-hover:text-accent transition-colors truncate">
                {selectedUserEmail ? entry.persona : entry.userName}
              </div>
              {!selectedUserEmail && (
                <div className="text-[10px] text-text-secondary flex items-center gap-1.5 opacity-60">
                   <Filter className="w-3 h-3" />
                   {entry.persona}
                </div>
              )}
            </div>
          ))}

          {filteredHistory.length === 0 && (
            <div className="text-center py-12 text-text-secondary">
              <div className="text-4xl mb-4 opacity-20">📂</div>
              <p className="text-xs uppercase tracking-widest opacity-40">Sem registros</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Right Column - Detail View */}
      <main className="flex-1 bg-card-bg border border-border-custom rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
        {selectedEntry ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header Detail */}
            <div className="p-6 border-b border-border-custom bg-gradient-to-r from-accent/5 to-transparent">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-2">
                    <h2 className="text-xl font-bold tracking-tight truncate">{selectedEntry.userName}</h2>
                    <div className="px-1.5 py-0.5 bg-accent/10 text-accent text-[9px] font-bold rounded uppercase">
                      {selectedEntry.userEmail}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-text-secondary">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(selectedEntry.date).toLocaleString('pt-BR')}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      {selectedEntry.persona}
                    </div>
                  </div>
                </div>
                <div className="text-center shrink-0">
                  <div className="text-4xl font-black text-accent">{selectedEntry.score}</div>
                  <div className="text-[9px] font-mono tracking-widest opacity-40 uppercase">Score</div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setActiveTab('report')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                    activeTab === 'report' ? "bg-accent text-bg-dark" : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  <Award className="w-4 h-4" />
                  RELATÓRIO
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                    activeTab === 'chat' ? "bg-accent text-bg-dark" : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  <MessageSquare className="w-4 h-4" />
                  VER CONVERSA
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
              <AnimatePresence mode="wait">
                {activeTab === 'report' ? (
                  <motion.div 
                    key="report"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-8"
                  >
                    <section>
                      <h4 className="card-title">Análise Especialista</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-5 bg-bg-dark/40 rounded-xl border border-border-custom">
                          <div className="text-[10px] font-bold text-success mb-3 uppercase flex items-center gap-2">
                             <CheckCircle2 className="w-3.5 h-3.5" />
                             Fortalezas
                          </div>
                          <p className="text-sm leading-relaxed text-text-primary/90">{selectedEntry.report.analise_comercial.pontos_fortes}</p>
                        </div>
                        <div className="p-5 bg-bg-dark/40 rounded-xl border border-border-custom">
                          <div className="text-[10px] font-bold text-warning mb-3 uppercase flex items-center gap-2">
                             <Clock className="w-3.5 h-3.5" />
                             Opportunity
                          </div>
                          <p className="text-sm leading-relaxed text-text-primary/90">{selectedEntry.report.analise_comercial.pontos_a_melhorar}</p>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="card-title">Checkpoints FDM</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: 'Pitch Claro', value: selectedEntry.report.checkpoints.pitch_claro_e_objetivo },
                          { label: 'Segurança', value: selectedEntry.report.checkpoints.tratou_objecoes_com_seguranca },
                          { label: 'Valor/Dor', value: selectedEntry.report.checkpoints.conectou_valor_a_dor },
                          { label: 'Fechamento', value: selectedEntry.report.checkpoints.conduziu_para_fechamento },
                        ].map((cp, i) => (
                          <div key={i} className="p-3 bg-bg-dark/30 rounded-xl border border-border-custom flex flex-col items-center gap-2 text-center">
                            {cp.value ? (
                              <div className="w-7 h-7 rounded-full bg-success/10 flex items-center justify-center text-success border border-success/20">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
                                <XCircle className="w-3.5 h-3.5" />
                              </div>
                            )}
                            <span className="text-[9px] font-bold uppercase tracking-wider">{cp.label}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <h4 className="card-title">Veredito Final</h4>
                      <div className="p-6 bg-accent/5 border-l-4 border-accent rounded-r-2xl italic text-lg leading-relaxed text-text-primary/80">
                        "{selectedEntry.report.analise_comercial.veredito}"
                      </div>
                    </section>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="chat"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    {!selectedEntry.chatHistory || selectedEntry.chatHistory.length === 0 ? (
                      <div className="text-center py-12 text-text-secondary italic text-sm">
                        Histórico de conversa não disponível para esta sessão.
                      </div>
                    ) : (
                      selectedEntry.chatHistory.map((msg, i) => (
                        <div key={i} className={cn(
                          "flex flex-col max-w-[90%]",
                          msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                        )}>
                          <div className="text-[9px] font-bold uppercase opacity-30 mb-1 px-1">
                            {msg.role === 'user' ? 'Vendedor' : selectedEntry.persona}
                          </div>
                          <div className={cn(
                            "px-4 py-3 rounded-2xl text-[13px] leading-relaxed",
                            msg.role === 'user' 
                              ? "bg-accent/10 border border-accent/20 text-accent rounded-tr-none" 
                              : "bg-white/5 border border-white/5 rounded-tl-none"
                          )}>
                            {msg.content}
                          </div>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-text-secondary p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-accent/5 border border-accent/10 flex items-center justify-center mb-6">
              <Users className="w-10 h-10 opacity-20" />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-2">Central de Monitoramento</h3>
            <p className="text-xs max-w-xs mx-auto leading-relaxed opacity-60">
              Selecione um usuário ou uma sessão específica para auditar o progresso e revisar o pitch comercial.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

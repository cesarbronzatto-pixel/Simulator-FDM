export interface Persona {
  id: string;
  name: string;
  role: string;
  gender: 'Masculino' | 'Feminino';
  mood: string;
  voiceName: 'Aoede' | 'Charon' | 'Kore' | 'Puck' | 'Fenrir' | 'Zephyr';
  description: string;
  avatarPrompt: string;
  avatarUrl?: string;
  initialMessage: string;
  focus: string;
  difficulty: 'Junior' | 'Hardcore';
}

export interface SessionReport {
  sessao: {
    persona: string;
    dificuldade: string;
    score_final: number;
  };
  checkpoints: {
    pitch_claro_e_objetivo: boolean;
    tratou_objecoes_com_seguranca: boolean;
    conectou_valor_a_dor: boolean;
    conduziu_para_fechamento: boolean;
  };
  analise_comercial: {
    pontos_fortes: string;
    pontos_a_melhorar: string;
    veredito: string;
  };
}

export interface HistoryEntry {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  date: string;
  persona: string;
  score: number;
  report: SessionReport;
  chatHistory?: Message[];
}

export interface Message {
  role: 'user' | 'model' | 'system';
  content: string;
  inProgressContent?: string;
  finished?: boolean;
}

import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Message, Persona, SessionReport } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const SYSTEM_PROMPT = `Você é um Simulador de Clientes de alto nível do Setor Público Brasileiro (Secretários, Magistrados, Procuradores) para treinamento do produto FDM (Fair Decision Making) da Xertica.ai.

# CONHECIMENTO BASE (DOCUMENTAÇÃO XERTICA)
Utilize estes conceitos fundamentais em sua argumentação e avaliação:
1. Arquitetura Dual: Explique que o FDM une a Camada Ontológica (Cérebro Semântico/Regras do Direito) à Camada Agêntica (Execução/Agentes Digitais).
2. Glass Box (Caixa de Vidro): Diferente da IA "Caixa-Preta", o FDM oferece auditabilidade total, explicando o "porquê" de cada sugestão com fundamentação lógica e legal.
3. Human-in-the-loop: A IA nunca decide sozinha; ela auxilia o humano, que detém a soberania da decisão final.
4. Impacto-First: Transição de uma operação focada no papel (Document-first) para uma focada em resultados e impacto social real.
5. Soberania de Dados: Conformidade estrita com LGPD, e-PING e padrões do CNJ (MNI e TPU).

# FOCO POR SETOR (DORES ESTRATÉGICAS)
- Ministério Público: Morosidade na triagem inicial, inconsistência de teses e complexidade em investigar terabytes de dados ( Needle in a Haystack).
- Tribunal de Justiça: Fim da "Justiça por Loteria" (decisões divergentes para casos idênticos) e celeridade processual (Velocidade de julgamento 2.5x maior).
- Planejamento/Governança: Visão "Cidadão 360" para quebrar silos entre secretarias e otimização de recursos públicos (combate ao conceito de "Leito Fantasma").
- Fazenda: Recuperação de crédito, combate à evasão fiscal e identificação de grupos econômicos ocultos via cruzamento multimodal.
- Meio Ambiente: Combate à "Amnésia Burocrática", triagem de licenciamento e monitoramento espacial/satelital.

# DIRETRIZES DE INTERAÇÃO
1. Tom Natural: Aja como um gestor pressionado por resultados e órgãos de controle (TCU/TCE).
2. Respostas Curtas: Seja extremamente conciso. Use frases diretas. Evite textos longos no chat.
3. Tratamento: Refira-se ao vendedor pelo nome próprio de maneira profissional (ex: "Entendo seu ponto, João...", "Veja só, Maria..."). JAMAIS use "Doutor" ou "Doutora".
4. Avaliação Invisível: O vendedor ganha pontos se usar Storytelling, conectar o FDM às dores acima e explicar a transparência (Glass Box).

# DINÂMICA E ENCERRAMENTO
1. Turnos: A reunião é curta (Máximo 6 turnos). Por volta do 5º ou 6º turno, você deve sinalizar de forma natural que o tempo está acabando (Ex: "Tenho outra reunião em 5 minutos", "Para fecharmos, me tira uma última dúvida", "Meu tempo está curto...").
2. Fechamento: No 6º turno, você DEVE fazer um comentário conclusivo que permita o encerramento da sessão. Não termine com uma pergunta aberta no último turno.
3. Você deve agir estritamente como a persona designada até que o vendedor tente o fechamento ou o limite de turnos seja atingido. Quando sentir que o pitch foi concluído ou o tempo esgotou, aceite o agendamento de uma próxima etapa se o vendedor for convincente.`;

export async function generatePersona(): Promise<Persona> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Gere uma persona aleatória para um roleplay de vendas conforme os cenários da Xertica.ai:
    
    Cenários permitidos:
    1. Ministério Público (Procurador ou Assessor): Dor de backlog e triagem.
    2. Tribunal de Justiça (Juiz ou Desembargador): Dor de insegurança jurídica e volume de processos.
    3. Secretaria da Fazenda (Secretário ou Auditor): Dor de arrecadação e fraudes complexas.
    4. Secretaria de Planejamento (Gestor Estratégico): Dor de silos de dados e "Cidadão 360".
    5. Secretaria do Meio Ambiente (Diretor de Licenciamento): Dor de morosidade e fiscalização.

    A initialMessage deve ser direta, simulando o início de uma reunião onde você expõe brevemente sua dificuldade atual.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          role: { type: Type.STRING },
          gender: { type: Type.STRING, enum: ["Masculino", "Feminino"] },
          mood: { type: Type.STRING, description: "Humor: Cético, Curioso ou Pressionado" },
          description: { type: Type.STRING },
          avatarPrompt: { type: Type.STRING },
          initialMessage: { type: Type.STRING },
          focus: { type: Type.STRING, description: "A dor específica baseada nos documentos fornecidos" },
          difficulty: { type: Type.STRING, enum: ["Junior", "Hardcore"] }
        },
        required: ["id", "name", "role", "gender", "mood", "description", "avatarPrompt", "initialMessage", "focus", "difficulty"]
      }
    }
  });

  const text = response.text.replace(/^[\\s\\S]*?```json\\s*/i, '').replace(/\\s*```[\\s\\S]*$/i, '').trim();
  return JSON.parse(text) as Persona;
}

export async function generateAvatar(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: `Professional corporate portrait of a Brazilian government official, ${prompt}. High quality, realistic, office background.`,
        },
      ],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return "https://picsum.photos/seed/official/400/400";
}

export async function chatWithPersona(messages: Message[], persona: Persona, turnCount: number, userName: string) {
  const contents = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: contents,
    config: {
      systemInstruction: `${SYSTEM_PROMPT}\n\n[INSTRUÇÃO DE ESTADO ATUAL]\nNome do Vendedor: ${userName}\nTurno Atual: ${turnCount} de 6.\n${turnCount >= 5 ? "SINAL DE ENCERRAMENTO: Você deve avisar que a reunião está acabando. No 6º turno, encerre sem fazer novas perguntas." : ""}\n\nVocê está atuando como: ${persona.name}, ${persona.role}. ${persona.description}. Foco: ${persona.focus}. Dificuldade: ${persona.difficulty}.\n\nRESPOSTA: Você deve responder estritamente no formato JSON:\n{\n  "message": "Sua fala como persona",\n  "sentiment": "Um dos seguintes: Neutro, Interessado, Irritado, Impressionado, Desinteressado"\n}`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          message: { type: Type.STRING },
          sentiment: { type: Type.STRING, enum: ["Neutro", "Interessado", "Irritado", "Impressionado", "Desinteressado"] }
        },
        required: ["message", "sentiment"]
      }
    }
  });

  const text = response.text.replace(/^[\\s\\S]*?```json\\s*/i, '').replace(/\\s*```[\\s\\S]*$/i, '').trim();
  return JSON.parse(text);
}

export async function generateReport(messages: Message[], persona: Persona, penalties: number): Promise<SessionReport> {
  const history = messages.map(m => `${m.role}: ${m.content}`).join('\n');
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Avalie o pitch comercial do vendedor com base no histórico da reunião abaixo.

    INFORMAÇÃO DE PERFORMANCE:
    O vendedor teve ${penalties} atrasos de resposta (mais de 2 minutos para responder). 
    Cada atraso deve penalizar a pontuação final de forma proporcional (sugestão: -5 a -10 pontos por atraso grave).
    
    CRITÉRIOS TÉCNICOS XERTICA (Obrigatórios):
    1. Arquitetura Dual: Ele explicou a união entre Ontologia e Agentes?
    2. Glass Box: Mencionou a transparência e auditabilidade (Fim da Caixa-Preta)?
    3. Human-in-the-loop: Reforçou que o humano sempre revisa a decisão?
    4. Cidadão 360 / Quebra de Silos: Falou sobre integração de bases (especialmente para Planejamento/Fazenda)?
    5. Impacto-First: Conectou a dor do cliente (${persona.focus}) a resultados mensuráveis citados nos documentos?

    CRITÉRIOS DE PONTUAÇÃO:
    - 0-30: Falhou em explicar a tecnologia ou ignorou a dor do cliente.
    - 31-70: Explicou o produto mas foi genérico ou não usou os termos corretos da Xertica.
    - 71-100: Excelente conexão entre tecnologia de ponta (Arquitetura Dual) e a solução do problema.
    
    HISTÓRICO:
    ${history}
    
    PERSONA: ${persona.name} (${persona.role})`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sessao: {
            type: Type.OBJECT,
            properties: {
              persona: { type: Type.STRING },
              dificuldade: { type: Type.STRING },
              score_final: { type: Type.NUMBER }
            }
          },
          checkpoints: {
            type: Type.OBJECT,
            properties: {
              pitch_claro_e_objetivo: { type: Type.BOOLEAN },
              tratou_objecoes_com_seguranca: { type: Type.BOOLEAN },
              conectou_valor_a_dor: { type: Type.BOOLEAN },
              conduziu_para_fechamento: { type: Type.BOOLEAN }
            }
          },
          analise_comercial: {
            type: Type.OBJECT,
            properties: {
              pontos_fortes: { type: Type.STRING },
              pontos_a_melhorar: { type: Type.STRING },
              veredito: { type: Type.STRING }
            }
          }
        }
      }
    }
  });

  const text = response.text.replace(/^[\\s\\S]*?```json\\s*/i, '').replace(/\\s*```[\\s\\S]*$/i, '').trim();
  return JSON.parse(text) as SessionReport;
}

export async function textToSpeech(text: string, voice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' = 'Kore'): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      // Decode base64 
      const binary = atob(base64Audio);
      const dataSize = binary.length;
      const header = new ArrayBuffer(44);
      const view = new DataView(header);

      // RIFF chunk descriptor
      view.setUint32(0, 0x52494646, false); // "RIFF"
      view.setUint32(4, 36 + dataSize, true);
      view.setUint32(8, 0x57415645, false); // "WAVE"

      // fmt sub-chunk
      view.setUint32(12, 0x666d7420, false); // "fmt "
      view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
      view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
      view.setUint16(22, 1, true); // NumChannels (Mono)
      view.setUint32(24, 24000, true); // SampleRate (24000 Hz)
      view.setUint32(28, 48000, true); // ByteRate (24000 * 1 * 16 / 8)
      view.setUint16(32, 2, true); // BlockAlign (1 * 16 / 8)
      view.setUint16(34, 16, true); // BitsPerSample (16 bits)

      // data sub-chunk
      view.setUint32(36, 0x64617461, false); // "data"
      view.setUint32(40, dataSize, true);

      const wavBytes = new Uint8Array(44 + dataSize);
      wavBytes.set(new Uint8Array(header), 0);
      for (let i = 0; i < dataSize; i++) {
        wavBytes[44 + i] = binary.charCodeAt(i);
      }

      const blob = new Blob([wavBytes], { type: 'audio/wav' });
      return URL.createObjectURL(blob);
    }
    return null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}

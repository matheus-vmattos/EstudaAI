export type Id = string

export interface Assunto {
  id: Id
  nome: string
  /** anotação em Markdown */
  nota: string
  atualizadoEm: number
}

export interface Materia {
  id: Id
  nome: string
  aberta: boolean
  assuntos: Assunto[]
}

export interface LinkGuardado {
  id: Id
  titulo: string
  url: string
  materiaId: Id | null
  assuntoId: Id | null
  criadoEm: number
}

export type Nivel = 'facil' | 'medio' | 'dificil'
export type TipoDeQuestao = 'multipla' | 'certoErrado'
export type IaDestino = 'claude' | 'gpt'

export interface Alternativa {
  letra: string
  texto: string
}

export interface Questao {
  enunciado: string
  alternativas: Alternativa[]
  gabarito: string
  resolucao: string
}

export interface ConfigDoSimulado {
  tema: string
  assuntoId: Id | null
  nivel: Nivel
  tipo: TipoDeQuestao
  quantidade: number
  tempoMin: number
  banca: string
}

export interface Simulado {
  id: Id
  config: ConfigDoSimulado
  questoes: Questao[]
  /** letra marcada em cada questão (null = em branco) */
  respostas: (string | null)[]
  revisar: boolean[]
  /** tempo gasto em cada questão, em ms */
  tempoPorQuestao: number[]
  /** tempo total corrido, em ms (pausas não contam) */
  decorridoMs: number
  atual: number
  criadoEm: number
  entregueEm: number | null
}

export type TipoDeCartao = 'basico' | 'lacuna'

/** Estado do agendamento (FSRS), com datas em texto ISO para caber no JSON */
export interface Agenda {
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  reps: number
  lapses: number
  learning_steps: number
  state: number
  last_review?: string
}

export interface Cartao {
  id: Id
  assuntoId: Id
  tipo: TipoDeCartao
  /** básico: a pergunta; lacuna: o texto com {{c1::...}} */
  frente: string
  /** básico: a resposta; lacuna: vazio (ou um comentário extra) */
  verso: string
  agenda: Agenda
  criadoEm: number
  /** quando foi estudado pela primeira vez (conta no limite de novos do dia) */
  primeiraRevisao?: number
}

/** Tópico do mapa mental: fica dentro de um assunto, e pode ter filhos */
export interface Topico {
  id: Id
  assuntoId: Id
  paiId: Id | null
  nome: string
  nota: string
}

export interface Dados {
  versao: 1
  materias: Materia[]
  links: LinkGuardado[]
  simulados: Simulado[]
  cartoes: Cartao[]
  topicos: Topico[]
  /** nós do mapa mental recolhidos (matéria, assunto ou tópico) */
  mapaRecolhidos: Id[]
  ultimoBackup?: number
}

export type EstadoDaAtualizacao =
  | { estado: 'parado' }
  | { estado: 'procurando' }
  | { estado: 'emDia'; verificadoEm: number }
  | { estado: 'baixando'; versao: string; porcento: number }
  | { estado: 'pronta'; versao: string }
  | { estado: 'erro'; mensagem: string }

export const DADOS_VAZIOS: Dados = {
  versao: 1,
  materias: [],
  links: [],
  simulados: [],
  cartoes: [],
  topicos: [],
  mapaRecolhidos: []
}

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

export interface Dados {
  versao: 1
  materias: Materia[]
  links: LinkGuardado[]
  simulados: Simulado[]
}

export type EstadoDaAtualizacao =
  | { estado: 'parado' }
  | { estado: 'baixando'; versao: string; porcento: number }
  | { estado: 'pronta'; versao: string }

export const DADOS_VAZIOS: Dados = { versao: 1, materias: [], links: [], simulados: [] }

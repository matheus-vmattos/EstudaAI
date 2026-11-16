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
  /** resumo de por que o gabarito está certo */
  resolucao: string
  /** por letra: por que cada alternativa está certa ou errada (v0.1.4+) */
  comentarios?: Record<string, string>
  /** 2–3 frases sobre o conceito cobrado (v0.1.4+) */
  conceito?: string
  /** marcador do subtema, para o diagnóstico (v0.1.5+) */
  topico?: string
  /** o que a questão exige (lista fixa em questoes.ts) (v0.1.5+) */
  habilidade?: string
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
  /** assunto OU tópico (v0.1.5+) onde o cartão mora */
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
  /** anotação do tópico (Markdown), como a do assunto */
  nota: string
  atualizadoEm?: number
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
  mapaVertical?: boolean
  /** baralhos com a seta ao contrário do padrão (matéria aberta, nós fechados) */
  baralhosInvertidos?: Id[]
  /** itens da caixa "Do Claude" já importados */
  caixaImportados?: string[]
  ultimoBackup?: number
}

/** Algo que o Claude preparou e publicou em conteudo/ do repositório */
export interface ItemDaCaixa {
  id: string
  tipo: 'estrutura' | 'simulado' | 'cartoes'
  titulo: string
  descricao?: string
  arquivo: string
  data?: string
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

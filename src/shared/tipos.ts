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
  /** termos para buscar a vídeo-aula no YouTube e canais sugeridos (v0.1.13+) */
  videoaula?: { busca: string; canais: string[] }
  /** matéria do edital (prova completa, v0.1.16+): o nome que a IA escreveu */
  materia?: string
}

/** Uma matéria dentro da prova completa: as questões de..ate (fim exclusivo) */
export interface MateriaNaProva {
  materiaId: Id
  nome: string
  /** peso da prova dela no edital (Gerais ×1, Específicos ×2) */
  peso: number
  de: number
  ate: number
}

/** A prova completa sendo montada bloco a bloco (cada bloco é um pedido à IA) */
export interface ProvaEmMontagem {
  criadoEm: number
  blocos: {
    materias: { materiaId: Id; nome: string; questoes: number; peso: number }[]
    /** as questões que já chegaram, na ordem das matérias do bloco */
    questoes: Questao[] | null
  }[]
}

/** O plano de estudo de um dia, fixado ao abrir (assim não muda no meio do dia) */
export interface PlanoDoDia {
  /** AAAA-MM-DD */
  dia: string
  tarefas: TarefaDoDia[]
  /** chaves marcadas à mão como feitas */
  marcadas: string[]
}

export type TarefaDoDia =
  | { chave: string; tipo: 'revisar'; titulo: string; detalhe: string; minutos: number }
  | {
      chave: string
      tipo: 'simulado'
      titulo: string
      detalhe: string
      minutos: number
      materiaId: Id
      /** existe se for o próximo adaptado de um simulado que já foi feito */
      simuladoId?: Id
    }
  | { chave: string; tipo: 'topico'; titulo: string; detalhe: string; minutos: number; lugarId: Id }

export interface ConfigDoSimulado {
  tema: string
  assuntoId: Id | null
  /** matéria do edital, quando o simulado é da matéria inteira (v0.1.15+) */
  materiaId?: Id
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
  /** prova completa no formato do edital (v0.1.16+): onde está cada matéria */
  prova?: { materias: MateriaNaProva[]; notaMinima?: number }
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
  /** o concurso: matérias, número de questões e peso (v0.1.15+) */
  edital?: Edital
  planoDoDia?: PlanoDoDia
  provaEmMontagem?: ProvaEmMontagem
  /** AAAA-MM-DD dos dias com estudo, para a sequência (v0.1.16+) */
  diasDeEstudo?: string[]
  /** o que você explicou com suas palavras ("Será que você sabe?"), v0.1.18+ */
  explicacoes?: Explicacao[]
  /** a missão da semana que veio do Claude (v0.1.18+) */
  missao?: Missao
  /** baralhos com a seta ao contrário do padrão (matéria aberta, nós fechados) */
  baralhosInvertidos?: Id[]
  /** itens da caixa "Do Claude" já importados */
  caixaImportados?: string[]
  ultimoBackup?: number
}

export interface MateriaDoEdital {
  materiaId: Id
  questoes: number
  /** peso da prova a que a matéria pertence (Gerais ×1, Específicos ×2) */
  peso: number
  /** o conteúdo programático da matéria, como está no edital */
  texto: string
}

export interface Edital {
  nome: string
  banca: string
  /** AAAA-MM-DD; '' se ainda não tem */
  dataProva: string
  notaMinima?: number
  /** duração da prova em minutos (v0.1.16+) */
  duracaoMin?: number
  materias: MateriaDoEdital[]
}

/** Algo que o Claude preparou e publicou em conteudo/ do repositório */
export interface ItemDaCaixa {
  id: string
  tipo: 'estrutura' | 'simulado' | 'cartoes' | 'edital' | 'missao'
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

export interface Explicacao {
  id: Id
  criadoEm: number
  topico: string
  pergunta: string
  texto: string
  /** de onde veio: a questão do simulado (quando veio do Raio-X) */
  simuladoId?: Id
  indice?: number
}

/** Uma tarefa da missão. As de simulado e cartões apontam para um item da
 *  caixa; "atrasados" é zerar os cartões do dia; "explicar" é escrever com
 *  suas palavras. */
export type TarefaDaMissao = {
  id: string
  titulo: string
  detalhe: string
  pontos: number
} & (
  | { tipo: 'simulado'; item: string; tema: string }
  | { tipo: 'cartoes'; item: string }
  | { tipo: 'atrasados' }
  | { tipo: 'explicar'; topico: string; pergunta: string }
)

export interface Missao {
  /** id do item da caixa */
  itemId: string
  recebidaEm: number
  /** AAAA-MM-DD */
  de: string
  ate: string
  frase: string
  tarefas: TarefaDaMissao[]
  /** ids das tarefas feitas (marcadas à mão ou vistas feitas) */
  feitas: string[]
  /** quando os cartões de cada tarefa foram importados (o criadoEm deles) */
  cartoesEm?: Record<string, number>
}

export const DADOS_VAZIOS: Dados = {
  versao: 1,
  materias: [],
  links: [],
  simulados: [],
  cartoes: [],
  topicos: [],
  mapaRecolhidos: []
}

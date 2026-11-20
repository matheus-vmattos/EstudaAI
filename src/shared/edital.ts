import { filaDoDia } from './flashcards'
import { nosDaMateria } from './arvore'
import { semAcento } from './texto'
import type { LeituraDaIa } from './questoes'
import type { Dados, Edital, Id, Simulado } from './tipos'

/** Quanto cada matéria vale na nota final (0 a 1).
 *  As matérias com o mesmo peso formam uma prova (Gerais ×1, Específicos
 *  ×2): cada prova vale o seu peso, repartido pelas questões dela.
 *  ponytail: agrupar pelo peso cobre o edital comum (uma prova por peso).
 *  Limite: duas provas separadas com o mesmo peso viram uma só na conta —
 *  aí a fração de cada matéria dentro delas fica um pouco diferente. */
export function pesoNaNota(e: Edital): Map<Id, number> {
  const porPeso = new Map<number, number>()
  for (const m of e.materias) porPeso.set(m.peso, (porPeso.get(m.peso) ?? 0) + m.questoes)
  const somaDosPesos = [...porPeso.keys()].reduce((a, p) => a + p, 0)
  const saida = new Map<Id, number>()
  for (const m of e.materias) {
    const questoesDaProva = porPeso.get(m.peso) ?? 0
    saida.set(
      m.materiaId,
      questoesDaProva && somaDosPesos ? ((m.questoes / questoesDaProva) * m.peso) / somaDosPesos : 0
    )
  }
  return saida
}

/** dias inteiros até a prova (0 no dia; negativo se já passou); null sem data */
export function diasAte(dataProva: string, hoje = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataProva)
  if (!m) return null
  const prova = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const dia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  return Math.round((prova.getTime() - dia.getTime()) / 86_400_000)
}

/** "24/01/2027" ou "2027-01-24" → "2027-01-24"; o resto → '' */
export function dataDoEdital(texto: string): string {
  const t = texto.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''
}

/** simulados entregues da matéria. Ligado a um assunto, vale onde o assunto
 *  está AGORA (ele pode ter sido movido de matéria); materiaId só conta no
 *  simulado da matéria inteira, sem assunto. */
export function simuladosDaMateria(d: Dados, materiaId: Id): Simulado[] {
  const m = d.materias.find((x) => x.id === materiaId)
  if (!m) return []
  const nos = new Set(nosDaMateria(d, m).map((n) => n.id))
  return d.simulados.filter(
    (s) =>
      s.entregueEm &&
      (s.config.assuntoId ? nos.has(s.config.assuntoId) : s.config.materiaId === materiaId)
  )
}

export interface SituacaoDaMateria {
  materiaId: Id
  nome: string
  questoes: number
  peso: number
  /** fração dos assuntos/tópicos com anotação ou cartão (0 a 1) */
  estudado: number
  /** acerto somado dos simulados (0 a 1); null se não fez nenhum */
  acerto: number | null
  paraRevisar: number
  ultimoSimulado: Simulado | null
}

/** como está cada matéria do edital, da que mais precisa de estudo para a
 *  que menos: peso na nota × o que ainda falta dominar */
export function situacaoDoEdital(d: Dados, agora = new Date()): SituacaoDaMateria[] {
  const e = d.edital
  if (!e) return []
  const pesos = pesoNaNota(e)
  const saida: SituacaoDaMateria[] = []
  for (const me of e.materias) {
    const m = d.materias.find((x) => x.id === me.materiaId)
    if (!m) continue
    const nos = nosDaMateria(d, m)
    const ids = new Set(nos.map((n) => n.id))
    const comCartao = new Set(d.cartoes.filter((c) => ids.has(c.assuntoId)).map((c) => c.assuntoId))
    const estudados = nos.filter((n) => n.nota.trim() || comCartao.has(n.id)).length
    const sims = simuladosDaMateria(d, m.id)
    const total = sims.reduce((n, s) => n + s.questoes.length, 0)
    const certas = sims.reduce(
      (n, s) => n + s.questoes.filter((q, i) => s.respostas[i] === q.gabarito).length,
      0
    )
    const fila = filaDoDia(d.cartoes, agora, ids)
    saida.push({
      materiaId: m.id,
      nome: m.nome,
      questoes: me.questoes,
      peso: pesos.get(m.id) ?? 0,
      estudado: nos.length ? estudados / nos.length : 0,
      acerto: total ? certas / total : null,
      paraRevisar: fila.revisar.length + fila.novos.length,
      ultimoSimulado: [...sims].sort((a, b) => (b.entregueEm ?? 0) - (a.entregueEm ?? 0))[0] ?? null
    })
  }
  // o que falta dominar: pelo acerto quando há simulado; senão, pelo que já estudou
  const falta = (s: SituacaoDaMateria): number => 1 - (s.acerto ?? s.estudado * 0.5)
  return saida.sort((a, b) => b.peso * falta(b) - a.peso * falta(a))
}

/** "% estudado" do edital inteiro, ponderado pelo peso de cada matéria */
export const estudadoPonderado = (s: SituacaoDaMateria[]): number =>
  s.reduce((n, x) => n + x.peso * x.estudado, 0) / (s.reduce((n, x) => n + x.peso, 0) || 1)

export type ProximoPasso =
  | { tipo: 'revisar'; texto: string }
  | { tipo: 'simulado'; texto: string }
  | { tipo: 'adaptar'; texto: string; simuladoId: Id }

/** o que fazer agora nessa matéria (um passo, o mais útil) */
export function proximoPasso(s: SituacaoDaMateria): ProximoPasso {
  if (s.paraRevisar > 0)
    return {
      tipo: 'revisar',
      texto: `Revisar ${s.paraRevisar} ${s.paraRevisar === 1 ? 'cartão' : 'cartões'}`
    }
  if (!s.ultimoSimulado) return { tipo: 'simulado', texto: 'Gerar 1º simulado' }
  if ((s.acerto ?? 0) < 0.7)
    return { tipo: 'adaptar', texto: 'Próximo adaptado', simuladoId: s.ultimoSimulado.id }
  return { tipo: 'simulado', texto: 'Novo simulado' }
}

// ---------- colar edital ----------

export interface MateriaLida {
  nome: string
  texto: string
  itens: number
}

/** "LÍNGUA PORTUGUESA" → "Língua Portuguesa"; siglas curtas ficam (ESG, LGPD) */
function nomeBonito(caixaAlta: string): string {
  const pequenas = new Set(['e', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na'])
  const palavra = (p: string, primeira: boolean): string => {
    if (p.length <= 4 && !/[ÁÉÍÓÚÂÊÔÃÕÇ]/.test(p) && !pequenas.has(p.toLowerCase())) return p
    const min = p.toLowerCase()
    if (!primeira && pequenas.has(min)) return min
    return min.charAt(0).toUpperCase() + min.slice(1)
  }
  return caixaAlta
    .trim()
    .split(/\s+/)
    .map((p, i) =>
      p
        .split('/')
        .map((x, k) => palavra(x, i === 0 || k > 0))
        .join('/')
    )
    .join(' ')
}

const MAIUSCULAS = 'A-ZÁÉÍÓÚÂÊÔÃÕÇÀ'
// a matéria começa no início da linha: "NOME EM MAIÚSCULAS: conteúdo"
const CABECA = new RegExp(`^\\s*([${MAIUSCULAS}][${MAIUSCULAS}0-9 ,/–\\-]{2,80}?)\\s*:\\s*(.*)$`)

/** linha de título de bloco ("CONHECIMENTOS GERAIS – APENAS para o Cargo
 *  TB"): quase toda em maiúsculas e sem dois-pontos */
function ehTituloDeBloco(linha: string): boolean {
  const letras = linha.replace(/[^A-Za-zÀ-ÿ]/g, '')
  const maiusculas = linha.replace(new RegExp(`[^${MAIUSCULAS}]`, 'g'), '')
  if (/^\s*CONHECIMENTOS\s+(GERAIS|ESPEC[IÍ]FICOS)\b/.test(linha)) return true
  return !linha.includes(':') && letras.length >= 8 && maiusculas.length / letras.length > 0.6
}

/** Acha as matérias no texto do edital: cada uma começa numa linha com
 *  "NOME EM MAIÚSCULAS:" e vai até a próxima (ou até um título de bloco). */
export function lerEditalColado(texto: string): MateriaLida[] {
  const achadas: { nome: string; partes: string[] }[] = []
  let atual: { nome: string; partes: string[] } | null = null
  for (const linha of texto.replace(/\r/g, '').split('\n')) {
    const m = CABECA.exec(linha)
    if (m && m[1] === m[1].toUpperCase() && new RegExp(`[${MAIUSCULAS}]{4,}`).test(m[1])) {
      atual = { nome: nomeBonito(m[1]), partes: [m[2]] }
      achadas.push(atual)
    } else if (ehTituloDeBloco(linha)) atual = null
    else if (atual) atual.partes.push(linha)
  }
  return achadas
    .map(({ nome, partes }) => {
      const conteudo = partes.join('\n').replace(/-\n/g, '').replace(/\s+/g, ' ').trim()
      return {
        nome,
        texto: conteudo,
        itens: itensDoEdital(conteudo).length
      }
    })
    .filter((x) => x.itens > 0)
}

/** os itens do conteúdo de uma matéria: cada frase vira um assunto
 *  ("Ortografia e acentuação. Crase." → ["Ortografia e acentuação", "Crase"]) */
export function itensDoEdital(conteudo: string): string[] {
  return conteudo
    .split(/\.\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/)
    .map((x) => x.trim().replace(/\.$/, ''))
    .filter((x) => x.length > 2)
    .map((x) => (x.length > 90 ? x.slice(0, 89).trimEnd() + '…' : x))
}

/** a matéria do app que corresponde ao nome do edital (sem acento; "Língua
 *  Portuguesa" acha "Português") */
export function acharMateria(d: Dados, nome: string): Id | null {
  const alvo = semAcento(nome).replace(/^lingua\s+/, '')
  const m = d.materias.find((x) => {
    const n = semAcento(x.nome)
    return n === alvo || n === semAcento(nome) || (alvo === 'portuguesa' && n === 'portugues')
  })
  return m?.id ?? null
}

/** O simulado pronto que veio da caixa "Do Claude". Entra na matéria que o
 *  arquivo indica (conta no Meu edital) e com a banca dele; sem matéria
 *  reconhecida, fica solto como antes. */
export function simuladoDaCaixa(
  d: Dados,
  leitura: Extract<LeituraDaIa, { ok: true }>,
  titulo: string,
  id: Id,
  agora: number
): Simulado {
  const n = leitura.questoes.length
  const materiaId = leitura.materia ? acharMateria(d, leitura.materia) : null
  return {
    id,
    config: {
      tema: leitura.tema || titulo,
      assuntoId: null,
      ...(materiaId ? { materiaId } : {}),
      nivel: 'medio',
      tipo: leitura.tipo,
      quantidade: n,
      // padrão de prova: 3 min por questão
      tempoMin: n * 3,
      banca: leitura.banca ?? ''
    },
    questoes: leitura.questoes,
    respostas: Array(n).fill(null),
    revisar: Array(n).fill(false),
    tempoPorQuestao: Array(n).fill(0),
    decorridoMs: 0,
    atual: 0,
    criadoEm: agora,
    entregueEm: null
  }
}

// ---------- edital pela caixa "Do Claude" ----------

export interface PacoteDeEdital {
  nome: string
  banca: string
  dataProva: string
  notaMinima?: number
  duracaoMin?: number
  materias: { nome: string; questoes: number; peso: number; texto: string }[]
}

/** lê o .json de edital publicado na caixa; recusa inteiro se algo faltar */
export function lerPacoteDeEdital(
  texto: string
): { ok: true; pacote: PacoteDeEdital } | { ok: false; erro: string } {
  let b: Partial<PacoteDeEdital>
  try {
    b = JSON.parse(texto) as Partial<PacoteDeEdital>
  } catch {
    return { ok: false, erro: 'O arquivo do edital veio quebrado.' }
  }
  const materias = Array.isArray(b.materias) ? b.materias : []
  const validas = materias.every(
    (m) =>
      m &&
      typeof m.nome === 'string' &&
      m.nome.trim() &&
      Number.isFinite(m.questoes) &&
      m.questoes > 0 &&
      Number.isFinite(m.peso) &&
      m.peso > 0
  )
  if (typeof b.nome !== 'string' || !b.nome.trim() || !materias.length || !validas)
    return { ok: false, erro: 'O arquivo do edital está incompleto.' }
  return {
    ok: true,
    pacote: {
      nome: b.nome.trim(),
      banca: typeof b.banca === 'string' ? b.banca.trim() : '',
      dataProva: typeof b.dataProva === 'string' ? dataDoEdital(b.dataProva) : '',
      notaMinima: Number.isFinite(b.notaMinima) ? b.notaMinima : undefined,
      duracaoMin: Number.isFinite(b.duracaoMin) ? b.duracaoMin : undefined,
      materias: materias.map((m) => ({
        nome: m.nome.trim(),
        questoes: Math.round(m.questoes),
        peso: m.peso,
        texto: typeof m.texto === 'string' ? m.texto.trim() : ''
      }))
    }
  }
}

/** grava o edital, ligando cada matéria à do app pelo nome (cria a que
 *  faltar, vazia; o mapa de assuntos vem do item de estrutura) */
export function importarEdital(
  d: Dados,
  p: PacoteDeEdital,
  novoId: () => Id
): { materias: number; criadas: number } {
  let criadas = 0
  const materias = p.materias.map((m) => {
    let id = acharMateria(d, m.nome)
    if (!id) {
      id = novoId()
      d.materias.push({ id, nome: m.nome, aberta: true, assuntos: [] })
      criadas++
    }
    return { materiaId: id, questoes: m.questoes, peso: m.peso, texto: m.texto }
  })
  d.edital = {
    nome: p.nome,
    banca: p.banca,
    dataProva: p.dataProva,
    notaMinima: p.notaMinima,
    duracaoMin: p.duracaoMin,
    materias
  }
  return { materias: materias.length, criadas }
}

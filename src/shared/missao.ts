import { filaDoDia } from './flashcards'
import { semAcento } from './texto'
import type { Dados, Edital, Missao, Questao, TarefaDaMissao } from './tipos'

const TIPOS_DE_TAREFA = new Set(['simulado', 'cartoes', 'atrasados', 'explicar', 'anotacoes'])

/** Lê o arquivo de missão da caixa "Do Claude". Tarefa de um tipo que esta
 *  versão não conhece é pulada (missão nova num app antigo). */
export function lerPacoteDeMissao(
  texto: string,
  itemId: string,
  agora: number
): { ok: true; missao: Missao } | { ok: false; erro: string } {
  let b: Record<string, unknown>
  try {
    b = JSON.parse(texto)
  } catch {
    return { ok: false, erro: 'O arquivo da missão não é um JSON válido.' }
  }
  const txt = (x: unknown): x is string => typeof x === 'string' && x.trim() !== ''
  if (!txt(b.de) || !txt(b.ate) || !Array.isArray(b.tarefas) || !b.tarefas.length)
    return { ok: false, erro: 'A missão precisa de "de", "ate" e "tarefas".' }
  const tarefas: TarefaDaMissao[] = []
  for (const [i, x] of (b.tarefas as Record<string, unknown>[]).entries()) {
    const base = {
      id: txt(x.id) ? x.id : `t${i + 1}`,
      titulo: txt(x.titulo) ? x.titulo : '',
      detalhe: txt(x.detalhe) ? x.detalhe : '',
      pontos: typeof x.pontos === 'number' && x.pontos > 0 ? Math.round(x.pontos) : 0
    }
    if (!base.titulo) return { ok: false, erro: `Tarefa ${i + 1}: falta o título.` }
    if (x.tipo === 'simulado' && txt(x.item) && txt(x.tema))
      tarefas.push({ ...base, tipo: 'simulado', item: x.item, tema: x.tema })
    else if (x.tipo === 'cartoes' && txt(x.item))
      tarefas.push({ ...base, tipo: 'cartoes', item: x.item })
    else if (x.tipo === 'atrasados') tarefas.push({ ...base, tipo: 'atrasados' })
    else if (x.tipo === 'anotacoes' && txt(x.item))
      tarefas.push({ ...base, tipo: 'anotacoes', item: x.item })
    else if (x.tipo === 'explicar' && txt(x.topico) && txt(x.pergunta))
      tarefas.push({ ...base, tipo: 'explicar', topico: x.topico, pergunta: x.pergunta })
    else if (TIPOS_DE_TAREFA.has(String(x.tipo)))
      return { ok: false, erro: `Tarefa ${i + 1}: tipo "${String(x.tipo)}" incompleto.` }
    // tipo que esta versão ainda não conhece: fica de fora, o resto da missão vale
  }
  if (!tarefas.length) return { ok: false, erro: 'Nenhuma tarefa desta missão abre nesta versão.' }
  return {
    ok: true,
    missao: {
      itemId,
      recebidaEm: agora,
      de: b.de,
      ate: b.ate,
      frase: txt(b.frase) ? b.frase : '',
      tarefas,
      feitas: []
    }
  }
}

/** A tarefa está feita pelos dados (sem precisar marcar):
 *  simulado entregue com o tema dela; cartões do pacote todos já vistos;
 *  nenhum cartão para hoje (vencido ou novo); explicação escrita sobre o tópico depois que a
 *  missão chegou. */
export function feitaPelosDados(
  d: Dados,
  m: Missao,
  t: TarefaDaMissao,
  agora = new Date()
): boolean {
  if (t.tipo === 'simulado')
    return d.simulados.some((s) => s.entregueEm && semAcento(s.config.tema) === semAcento(t.tema))
  if (t.tipo === 'cartoes') {
    // os cartões do pacote, pela frente: vale também para os que você já
    // tinha importado antes pela tela Do Claude (a importação não duplica)
    const frentes = new Set(m.cartoesFrentes?.[t.id] ?? [])
    const doPacote = d.cartoes.filter((c) => frentes.has(c.frente.trim()))
    return doPacote.length > 0 && doPacote.every((c) => c.primeiraRevisao)
  }
  // ler não dá para medir: abrir as anotações (importá-las) conta
  if (t.tipo === 'anotacoes') return (d.caixaImportados ?? []).includes(t.item)
  if (t.tipo === 'atrasados') {
    // "os cartões de hoje" = os vencidos e os novos do dia, como no menu
    const f = filaDoDia(d.cartoes, agora)
    return f.revisar.length + f.novos.length === 0
  }
  // a mesma pergunta respondida no Raio-X também vale (é o mesmo conceito)
  return (d.explicacoes ?? []).some(
    (x) =>
      Math.max(x.criadoEm, x.atualizadoEm ?? 0) >= m.recebidaEm &&
      (semAcento(x.topico) === semAcento(t.topico) ||
        semAcento(x.pergunta.trim()) === semAcento(t.pergunta.trim()))
  )
}

export const tarefaFeita = (m: Missao, t: TarefaDaMissao): boolean => m.feitas.includes(t.id)

export function pontosDaMissao(m: Missao): { feitos: number; total: number } {
  return {
    feitos: m.tarefas.filter((t) => tarefaFeita(m, t)).reduce((n, t) => n + t.pontos, 0),
    total: m.tarefas.reduce((n, t) => n + t.pontos, 0)
  }
}

/** "Explique com suas palavras": o pedido de correção para a IA, com o
 *  conceito de referência (quando a explicação veio de uma questão). */
export function promptDeConferir(
  e: Edital | undefined,
  topico: string,
  pergunta: string,
  texto: string,
  q?: Questao
): string {
  return [
    `Estou estudando para o concurso ${e ? `${e.nome}${e.banca ? ` (banca ${e.banca})` : ''}` : 'público'}.`,
    `Tópico: ${topico}.`,
    `Pergunta: ${pergunta}`,
    '',
    'Minha explicação, com minhas palavras:',
    texto.trim(),
    '',
    ...(q
      ? [
          'Referência (da questão que errei ou acertei com dúvida):',
          q.enunciado,
          `Gabarito: ${q.gabarito}. ${q.conceito ?? q.resolucao}`,
          ''
        ]
      : []),
    'Corrija a minha explicação como um professor de cursinho, em até 10 linhas:',
    '1. O que está certo.',
    '2. O que está errado ou impreciso (com a regra correta e a fonte: lei e artigo, ou a fórmula).',
    '3. O que faltou e a banca costuma cobrar (pegadinhas).',
    'Confira na legislação vigente; se não tiver certeza de algo, diga.'
  ].join('\n')
}

/** A missão nova substitui a anterior. Se é a mesma semana republicada (mesmo
 *  início, ex.: uma tarefa a mais), o que você já fez e os cartões de cada
 *  tarefa continuam valendo, e as explicações contam desde a primeira versão. */
export function continuarMissao(nova: Missao, anterior?: Missao): Missao {
  if (!anterior || anterior.de !== nova.de) return nova
  const ids = new Set(nova.tarefas.map((t) => t.id))
  const frentes = Object.fromEntries(
    Object.entries(anterior.cartoesFrentes ?? {}).filter(([id]) => ids.has(id))
  )
  return {
    ...nova,
    recebidaEm: anterior.recebidaEm,
    feitas: anterior.feitas.filter((id) => ids.has(id)),
    ...(Object.keys(frentes).length ? { cartoesFrentes: frentes } : {})
  }
}

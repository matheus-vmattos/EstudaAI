import type { Alternativa, ConfigDoSimulado, IaDestino, Questao, TipoDeQuestao } from './tipos'

const NOME_DO_NIVEL = { facil: 'FÁCIL', medio: 'MÉDIO', dificil: 'DIFÍCIL' } as const

export const LETRAS: Record<TipoDeQuestao, string[]> = {
  multipla: ['A', 'B', 'C', 'D', 'E'],
  certoErrado: ['C', 'E']
}

/** O prompt que o usuário cola no Claude ou no ChatGPT. O formato do JSON é
 *  o contrato com `lerRespostaDaIa`: mudou um, muda o outro. */
export function montarPrompt(c: ConfigDoSimulado, ia: IaDestino): string {
  const banca = c.banca.trim()
  const multipla = c.tipo === 'multipla'
  const estilo = banca ? `no estilo da banca ${banca}` : 'no estilo de prova de concurso público'
  const formato = multipla
    ? 'múltipla escolha com 5 alternativas (A a E) e só uma correta'
    : 'itens de julgar CERTO ou ERRADO'
  const exemploAlternativas = multipla
    ? '"alternativas": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "..." },\n      "gabarito": "B",'
    : '"alternativas": { "C": "Certo", "E": "Errado" },\n      "gabarito": "E",'
  const resolucao = multipla
    ? 'explicando por que a correta está certa e por que cada uma das outras está errada'
    : 'explicando por que o item está certo ou errado'

  const pedido = [
    `Crie ${c.quantidade} questões inéditas de nível ${NOME_DO_NIVEL[c.nivel]} sobre "${c.tema.trim()}", ${estilo}.`,
    `Formato: ${formato}.`,
    `Cada questão precisa de enunciado, alternativas, gabarito e resolução ${resolucao}.`,
    'Varie os aspectos cobrados do tema e não repita questões.',
    multipla ? 'Distribua o gabarito entre as letras, sem padrão previsível.' : ''
  ]
    .filter(Boolean)
    .join('\n')

  const json = `{
  "versao": 1,
  "tema": "${c.tema.trim().replace(/"/g, "'")}",
  "questoes": [
    {
      "enunciado": "...",
      ${exemploAlternativas}
      "resolucao": "..."
    }
  ]
}`

  // ponytail: Claude segue melhor instruções em tags XML; o ChatGPT, em texto
  // corrido. O conteúdo pedido e o formato do JSON são os mesmos nos dois.
  if (ia === 'claude') {
    return `Você é um elaborador experiente de questões de concurso público.

<tarefa>
${pedido}
</tarefa>

<formato_do_arquivo>
${json}
</formato_do_arquivo>

<entrega>
${ENTREGA}
</entrega>`
  }
  return `Você é um elaborador experiente de questões de concurso público.

${pedido}

Formato do arquivo (JSON válido, sem comentários):
${json}

${ENTREGA}`
}

/** O estudante vai resolver as questões depois: ver o gabarito na conversa
 *  estraga o estudo. Por isso o pedido é um arquivo para baixar; o bloco de
 *  código é o plano B (tem botão de copiar, sem precisar ler). */
const ENTREGA = `IMPORTANTE: o estudante vai resolver estas questões depois e NÃO pode ver as respostas antes.
- Entregue o JSON como um ARQUIVO para download chamado simulado.json.
- Na conversa, NÃO escreva as questões, as alternativas, o gabarito nem as resoluções. Escreva só uma linha com o link do arquivo.
- Se você não puder criar arquivos, responda com UM ÚNICO bloco de código json contendo o JSON inteiro, sem nenhum texto antes ou depois do bloco.`

export type LeituraDaIa =
  { ok: true; tema: string; tipo: TipoDeQuestao; questoes: Questao[] } | { ok: false; erro: string }

/** pega o JSON mesmo que venha dentro de ```json ... ``` ou com texto em volta */
function extrairJson(texto: string): unknown {
  const inicio = texto.indexOf('{')
  const fim = texto.lastIndexOf('}')
  if (inicio < 0 || fim <= inicio) throw new Error('sem json')
  const bruto = texto.slice(inicio, fim + 1)
  // Texto copiado da conversa (e não do bloco de código) às vezes chega com
  // aspas curvas ou vírgula sobrando no fim. Tenta do jeito que veio e, só
  // se não der, com essas correções: uma aspa curva DENTRO de um texto
  // válido nunca é trocada.
  const tentativas = [
    bruto,
    bruto.replace(/[\u201C\u201D\u201E\u201F]/g, '"'),
    bruto.replace(/[\u201C\u201D\u201E\u201F]/g, '"').replace(/,\s*([}\]])/g, '$1')
  ]
  for (const t of tentativas) {
    try {
      return JSON.parse(t)
    } catch {
      /* próxima tentativa */
    }
  }
  throw new Error('json inválido')
}

const textoValido = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

/** Lê o que a IA respondeu. Nunca inventa: se faltar algo, diz qual questão
 *  e o que falta. */
export function lerRespostaDaIa(texto: string): LeituraDaIa {
  let bruto: unknown
  try {
    bruto = extrairJson(texto)
  } catch {
    return {
      ok: false,
      erro: 'Não encontrei um JSON válido na resposta. Copie a resposta inteira da IA.'
    }
  }
  const raiz = bruto as { tema?: unknown; questoes?: unknown }
  if (!Array.isArray(raiz.questoes) || raiz.questoes.length === 0) {
    return { ok: false, erro: 'A resposta não tem a lista "questoes".' }
  }

  const questoes: Questao[] = []
  let tipo: TipoDeQuestao | null = null
  for (const [i, q] of (raiz.questoes as unknown[]).entries()) {
    const n = `Questão ${i + 1}`
    const item = q as Record<string, unknown>
    if (!item || typeof item !== 'object') return { ok: false, erro: `${n}: formato inválido.` }
    if (!textoValido(item.enunciado)) return { ok: false, erro: `${n}: falta o enunciado.` }
    if (!textoValido(item.resolucao)) return { ok: false, erro: `${n}: falta a resolução.` }

    const alts = item.alternativas
    if (!alts || typeof alts !== 'object' || Array.isArray(alts)) {
      return { ok: false, erro: `${n}: faltam as alternativas.` }
    }
    const alternativas: Alternativa[] = Object.entries(alts as Record<string, unknown>)
      .filter(([, t]) => textoValido(t))
      .map(([letra, t]) => ({ letra: letra.trim().toUpperCase(), texto: (t as string).trim() }))
      // a ordem das chaves no JSON não muda a questão: mostra sempre A→E
      .sort((a, b) => a.letra.localeCompare(b.letra))
    const letras = alternativas.map((a) => a.letra).join('')
    const tipoDaQuestao: TipoDeQuestao | null =
      letras === 'ABCDE' ? 'multipla' : letras === 'CE' ? 'certoErrado' : null
    if (!tipoDaQuestao) {
      return {
        ok: false,
        erro: `${n}: as alternativas devem ser A a E, ou C (certo) e E (errado).`
      }
    }
    if (tipo && tipo !== tipoDaQuestao) {
      return { ok: false, erro: `${n}: mistura múltipla escolha com certo/errado.` }
    }
    tipo = tipoDaQuestao

    const gabarito = textoValido(item.gabarito) ? item.gabarito.trim().toUpperCase() : ''
    if (!LETRAS[tipoDaQuestao].includes(gabarito)) {
      return {
        ok: false,
        erro: `${n}: gabarito "${String(item.gabarito ?? '')}" não é uma das alternativas.`
      }
    }
    questoes.push({
      enunciado: item.enunciado.trim(),
      alternativas,
      gabarito,
      resolucao: item.resolucao.trim()
    })
  }
  return {
    ok: true,
    tema: textoValido(raiz.tema) ? raiz.tema.trim() : '',
    tipo: tipo ?? 'multipla',
    questoes
  }
}

/** 3725000 → "01:02:05" */
export function formatarTempo(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const dois = (n: number): string => String(n).padStart(2, '0')
  return h > 0 ? `${dois(h)}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`
}

export function acertos(questoes: Questao[], respostas: (string | null)[]): number {
  return questoes.reduce((soma, q, i) => soma + (respostas[i] === q.gabarito ? 1 : 0), 0)
}

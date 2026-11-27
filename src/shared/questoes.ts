import { dobrarBarrasDoLatex } from './formulas'
import type {
  Alternativa,
  ConfigDoSimulado,
  IaDestino,
  Id,
  Questao,
  Simulado,
  TipoDeQuestao
} from './tipos'

const NOME_DO_NIVEL = { facil: 'FÁCIL', medio: 'MÉDIO', dificil: 'DIFÍCIL' } as const

export const LETRAS: Record<TipoDeQuestao, string[]> = {
  multipla: ['A', 'B', 'C', 'D', 'E'],
  certoErrado: ['C', 'E']
}

/** O prompt que o usuário cola no Claude ou no ChatGPT. O formato do JSON é
 *  o contrato com `lerRespostaDaIa`: mudou um, muda o outro. */
export const HABILIDADES = [
  'lembrar conceito',
  'aplicar regra',
  'interpretar texto',
  'identificar exceção ou pegadinha'
] as const

export function montarPrompt(
  c: ConfigDoSimulado,
  ia: IaDestino,
  /** bloco extra do simulado adaptado (adaptado.ts) */
  adaptacao = ''
): string {
  const banca = c.banca.trim()
  const multipla = c.tipo === 'multipla'
  const estilo = banca ? `no estilo da banca ${banca}` : 'no estilo de prova de concurso público'
  const formato = multipla
    ? 'múltipla escolha com 5 alternativas (A a E) e só uma correta'
    : 'itens de julgar CERTO ou ERRADO'
  const exemploAlternativas = multipla
    ? '"alternativas": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "..." },\n      "gabarito": "B",'
    : '"alternativas": { "C": "Certo", "E": "Errado" },\n      "gabarito": "E",'
  const exemploComentarios = multipla
    ? '"comentarios": { "A": "por que está errada", "B": "por que está certa", "C": "...", "D": "...", "E": "..." },'
    : '"comentarios": { "C": "por que não está certo", "E": "por que está errado" },'

  const pedido = [
    `Crie ${c.quantidade} questões inéditas de nível ${NOME_DO_NIVEL[c.nivel]} sobre "${c.tema.trim()}", ${estilo}.`,
    `Formato: ${formato}.`,
    'Cada questão precisa de:',
    '- enunciado, alternativas e gabarito;',
    '- resolucao: 1 a 2 frases dizendo por que o gabarito está certo; se a questão tiver cálculo, o passo a passo, uma etapa por linha (fórmula → valores no lugar das letras → resultado);',
    `- comentarios: para CADA ${multipla ? 'alternativa (A a E)' : 'opção (C e E)'}, 1 frase curta dizendo por que está certa ou errada;`,
    '- conceito: 2 a 3 frases explicando o conceito ou a regra que a questão cobra, para o estudante fixar;',
    '- topico: o subtema exato da questão, em poucas palavras (ex.: "Juros compostos"), sempre com o mesmo nome para o mesmo subtema;',
    `- habilidade: o que a questão exige, uma destas: ${HABILIDADES.join('; ')}.`,
    '- videoaula: "busca" com os termos para achar uma boa aula disso no YouTube (ex.: "juros compostos montante concurso") e "canais" com até 2 canais conhecidos de concurso que ensinam esse ponto; não escreva links.',
    'Enunciado fácil de ler: com texto de apoio, comece por "Leia o texto:", uma linha em branco, o texto (um parágrafo por linha), outra linha em branco e a pergunta; afirmativas para julgar em itens "I.", "II.", "III." um por linha; palavras de comando em CAIXA ALTA (NÃO, EXCETO, INCORRETA, APENAS); o trecho que a pergunta manda observar entre <u> e </u>; lei ou norma citada sempre com o assunto dela (ex.: "Lei nº 9.613/1998, sobre lavagem de dinheiro"), nunca só o número.',
    'Fórmulas em LaTeX entre cifrões, ex.: $M = C(1+i)^n$ — no JSON, com a barra invertida dobrada (\\\\frac, \\\\cdot). Dinheiro como "R$ 1.000,00", com espaço depois do R$.',
    'Se a questão depender de dado que muda com o tempo (taxa Selic, inflação, normas recentes), use o mais recente que você conhece, diga no comentário o mês/ano de referência e nunca invente número.',
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
      "resolucao": "...",
      ${exemploComentarios}
      "conceito": "...",
      "topico": "...",
      "habilidade": "${HABILIDADES[1]}",
      "videoaula": { "busca": "...", "canais": ["..."] }
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
${adaptacao ? `\n<adaptacao>\n${adaptacao}\n</adaptacao>\n` : ''}
<formato_do_arquivo>
${json}
</formato_do_arquivo>

<entrega>
${ENTREGA}
</entrega>`
  }
  return `Você é um elaborador experiente de questões de concurso público.

${pedido}${adaptacao ? `\n\n${adaptacao}` : ''}

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
  | {
      ok: true
      tema: string
      tipo: TipoDeQuestao
      questoes: Questao[]
      /** matéria e banca, quando o simulado vem pronto (caixa "Do Claude") */
      materia?: string
      banca?: string
    }
  | { ok: false; erro: string }

/** pega o JSON mesmo que venha dentro de ```json ... ``` ou com texto em volta */
function extrairJson(texto: string): unknown {
  const inicio = texto.indexOf('{')
  const fim = texto.lastIndexOf('}')
  if (inicio < 0 || fim <= inicio) throw new Error('sem json')
  const bruto = dobrarBarrasDoLatex(texto.slice(inicio, fim + 1))
  try {
    return JSON.parse(bruto)
  } catch {
    return JSON.parse(consertarJsonCopiado(bruto))
  }
}

const ASPAS_CURVAS = '\u201C\u201D\u201E\u201F'
const SINAIS_DEPOIS_DO_TEXTO = ':,}]'

/** Texto copiado da conversa (e não do bloco de código) às vezes chega com
 *  aspas curvas no lugar das retas e vírgula sobrando antes de } ou ].
 *  Conserta só a ESTRUTURA do JSON: anda caractere por caractere sabendo
 *  onde cada texto começa e termina, então nada dentro de um enunciado,
 *  alternativa ou resolução é alterado. */
export function consertarJsonCopiado(json: string): string {
  let saida = ''
  let i = 0
  const proximoSinal = (de: number): string => {
    let j = de
    while (j < json.length && /\s/.test(json[j])) j++
    return json[j] ?? ''
  }
  while (i < json.length) {
    const c = json[i]
    if (c === '"' || ASPAS_CURVAS.includes(c)) {
      // um texto: copia até a aspa que o fecha
      const curva = c !== '"'
      saida += '"'
      i++
      while (i < json.length) {
        const d = json[i]
        if (d === '\\') {
          // \“ (escape com aspa curva) vira \" — senão é escape inválido
          const proximo = json[i + 1] ?? ''
          saida += d + (ASPAS_CURVAS.includes(proximo) ? '"' : proximo)
          i += 2
          continue
        }
        const fecha = curva
          ? ASPAS_CURVAS.includes(d) && SINAIS_DEPOIS_DO_TEXTO.includes(proximoSinal(i + 1))
          : d === '"'
        if (fecha) break
        // aspa reta dentro de um texto aberto com aspa curva precisa de escape
        saida += curva && d === '"' ? '\\"' : d
        i++
      }
      saida += '"'
      i++
      continue
    }
    // vírgula sobrando antes de } ou ]
    if (c === ',' && '}]'.includes(proximoSinal(i + 1))) {
      i++
      continue
    }
    saida += c
    i++
  }
  return saida
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
  const raiz = bruto as { tema?: unknown; questoes?: unknown; materia?: unknown; banca?: unknown }
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
      resolucao: item.resolucao.trim(),
      ...lerExtras(item, alternativas)
    })
  }
  return {
    ok: true,
    tema: textoValido(raiz.tema) ? raiz.tema.trim() : '',
    tipo: tipo ?? 'multipla',
    questoes,
    ...(textoValido(raiz.materia) ? { materia: raiz.materia.trim() } : {}),
    ...(textoValido(raiz.banca) ? { banca: raiz.banca.trim() } : {})
  }
}

/** O tempo do simulado colado: o ritmo que você escolheu (minutos por
 *  questão pedida) vezes as questões que vieram. Colar uma prova de 55 com o
 *  formulário em "10 questões, 30 min" dá 165 min, e não 30. Sem limite (0)
 *  continua sem limite. */
export function tempoDoColado(tempoMin: number, pedidas: number, vieram: number): number {
  if (!tempoMin) return 0
  if (pedidas < 1 || vieram === pedidas) return tempoMin
  return Math.max(1, Math.round((tempoMin / pedidas) * vieram))
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

/** comentários por letra e conceito: opcionais (arquivos antes da v0.1.4
 *  não têm); o que vier fora do formato é ignorado, nunca inventado */
function lerExtras(
  item: Record<string, unknown>,
  alternativas: Alternativa[]
): Pick<
  Questao,
  'comentarios' | 'conceito' | 'topico' | 'habilidade' | 'videoaula' | 'materia' | 'explicar'
> {
  const extras: Pick<
    Questao,
    'comentarios' | 'conceito' | 'topico' | 'habilidade' | 'videoaula' | 'materia' | 'explicar'
  > = {}
  if (textoValido(item.materia)) extras.materia = item.materia.trim()
  if (textoValido(item.explicar)) extras.explicar = item.explicar.trim()
  const c = item.comentarios
  if (c && typeof c === 'object' && !Array.isArray(c)) {
    const letras = new Set(alternativas.map((a) => a.letra))
    const comentarios: Record<string, string> = {}
    for (const [k, v] of Object.entries(c as Record<string, unknown>)) {
      const letra = k.trim().toUpperCase()
      if (letras.has(letra) && textoValido(v)) comentarios[letra] = v.trim()
    }
    if (Object.keys(comentarios).length) extras.comentarios = comentarios
  }
  if (textoValido(item.conceito)) extras.conceito = item.conceito.trim()
  if (textoValido(item.topico)) extras.topico = item.topico.trim()
  if (textoValido(item.habilidade)) extras.habilidade = item.habilidade.trim().toLowerCase()
  const v = item.videoaula as { busca?: unknown; canais?: unknown } | undefined
  if (v && typeof v === 'object' && textoValido(v.busca))
    extras.videoaula = {
      busca: v.busca.trim().slice(0, 120),
      canais: (Array.isArray(v.canais) ? v.canais : [])
        .filter(textoValido)
        .map((c) => c.trim().slice(0, 60))
        .slice(0, 3)
    }
  return extras
}

/** Resolução já separada por alternativa. Se a questão veio com
 *  `comentarios`, usa eles; senão (simulados antigos) tenta quebrar o texto
 *  nos trechos "A errada: …", "E correta: …". Se não reconhecer o padrão em
 *  pelo menos duas letras, não arrisca: devolve o texto inteiro em `resto`. */
export function resolucaoPorLetra(q: Questao): { porLetra: Record<string, string>; resto: string } {
  if (q.comentarios && Object.keys(q.comentarios).length) {
    const porLetra = { ...q.comentarios }
    // a resolução vai junto do gabarito quando ele não tem comentário; se
    // tem, ela fica no bloco próprio (é onde está o passo a passo da conta)
    if (porLetra[q.gabarito]) return { porLetra, resto: q.resolucao }
    porLetra[q.gabarito] = q.resolucao
    return { porLetra, resto: '' }
  }
  const letras = q.alternativas.map((a) => a.letra)
  // certo/errado usa C e E, que confundem com "C errada"/"E correta": não quebra
  if (letras.join('') !== 'ABCDE') return { porLetra: {}, resto: q.resolucao }
  const marca =
    /(?:^|(?<=[.;!?]\s+)|(?<=\n))\(?([A-E])\)?\s*(?:\)|-|–)?\s*(?:está\s+|é\s+)?(?:correta|certa|incorreta|errada)\b\s*[:.,\-–]?\s*/g
  const achados = [...q.resolucao.matchAll(marca)]
  const distintas = new Set(achados.map((m) => m[1]))
  if (distintas.size < 2) return { porLetra: {}, resto: q.resolucao }
  const porLetra: Record<string, string> = {}
  achados.forEach((m, i) => {
    const inicio = m.index! + m[0].length
    const fim = i + 1 < achados.length ? achados[i + 1].index! : q.resolucao.length
    const texto = q.resolucao.slice(inicio, fim).trim()
    if (texto) porLetra[m[1]] = porLetra[m[1]] ? `${porLetra[m[1]]} ${texto}` : texto
  })
  const resto = q.resolucao.slice(0, achados[0].index).trim()
  return { porLetra, resto }
}

/** Fisher–Yates: cada ordem tem a mesma chance */
export function embaralhar<T>(lista: T[], aleatorio: () => number = Math.random): T[] {
  const copia = [...lista]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

/** Simulado novo com as mesmas questões em outra ordem, zerado.
 *  ponytail: só a ordem das QUESTÕES muda. Embaralhar as alternativas
 *  quebraria as do tipo "A e B estão corretas". */
export function refazerEmbaralhado(
  s: Simulado,
  id: Id,
  agora: number,
  aleatorio: () => number = Math.random
): Simulado {
  const n = s.questoes.length
  return {
    id,
    config: { ...s.config },
    questoes: embaralhar(s.questoes, aleatorio),
    respostas: Array(n).fill(null),
    revisar: Array(n).fill(false),
    tempoPorQuestao: Array(n).fill(0),
    decorridoMs: 0,
    atual: 0,
    criadoEm: agora,
    entregueEm: null
  }
}

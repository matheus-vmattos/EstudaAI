import type { IaDestino, Questao, Simulado } from './tipos'

/** Busca no YouTube, não um vídeo: a IA inventa link de vídeo que não
 *  existe; a página de busca sempre abre e mostra as aulas daquilo. */
export const buscaNoYoutube = (termos: string): string =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(termos.trim())}`

/** a busca da vídeo-aula da questão; simulado antigo (sem o campo) usa o
 *  tópico ou o tema */
export function termosDaVideoaula(q: Questao, tema: string): string {
  if (q.videoaula?.busca) return q.videoaula.busca
  return `${(q.topico || tema).trim()} concurso`
}

export type MotivoDoEstudo = 'errou' | 'branco' | 'duvida'

/** As questões que valem estudar: erradas, em branco e as marcadas "p/
 *  revisar" (mesmo acertadas: acerto com dúvida ainda é ponto fraco). */
export function questoesParaEstudar(s: Simulado): { indice: number; motivo: MotivoDoEstudo }[] {
  const saida: { indice: number; motivo: MotivoDoEstudo }[] = []
  s.questoes.forEach((q, i) => {
    const r = s.respostas[i]
    if (r === null) saida.push({ indice: i, motivo: 'branco' })
    else if (r !== q.gabarito) saida.push({ indice: i, motivo: 'errou' })
    else if (s.revisar[i]) saida.push({ indice: i, motivo: 'duvida' })
  })
  return saida
}

const textoDaAlternativa = (q: Questao, letra: string | null): string => {
  if (!letra) return '(deixou em branco)'
  const a = q.alternativas.find((x) => x.letra === letra)
  return a ? `${letra}) ${a.texto}` : letra
}

/** Prompt de estudo (não de simulado): a IA explica onde o raciocínio
 *  desviou em cada questão. A resposta é Markdown, para virar anotação. */
export function montarPromptDeEstudo(s: Simulado, indices: number[], ia: IaDestino): string {
  const banca = s.config.banca.trim()
  const blocos = indices.map((i, n) => {
    const q = s.questoes[i]
    const minha = s.respostas[i]
    const motivo =
      minha === null
        ? 'Deixei em branco.'
        : minha === q.gabarito
          ? 'Acertei, mas marquei para revisar: não tenho certeza do porquê.'
          : 'Errei.'
    return [
      `### Questão ${n + 1}${q.topico ? ` — ${q.topico}` : ''}`,
      q.enunciado.trim(),
      '',
      ...q.alternativas.map((a) => `${a.letra}) ${a.texto}`),
      '',
      `Minha resposta: ${textoDaAlternativa(q, minha)}`,
      `Gabarito: ${textoDaAlternativa(q, q.gabarito)}`,
      motivo
    ].join('\n')
  })

  const pedido = [
    `Sou estudante de concurso público (tema: "${s.config.tema.trim()}"${banca ? `, banca ${banca}` : ''}). Abaixo estão questões que errei ou acertei sem certeza. Quero entender onde meu raciocínio falhou, não só a resposta.`,
    '',
    'Para CADA questão, responda em Markdown com estas seções:',
    '- **Onde o raciocínio desviou**: por que a alternativa que escolhi parece certa e qual detalhe a derruba (se acertei com dúvida, qual é a justificativa segura).',
    '- **O conceito**: a regra ou teoria por trás, mais completa que um resumo, em linguagem simples.',
    '- **Exemplo resolvido**: um caso parecido, resolvido passo a passo.',
    '- **Confira se entendeu**: uma pergunta curta, com a resposta no fim da seção.',
    '- **Vídeo-aulas**: 1 ou 2 buscas no YouTube no formato [▶ termos de busca](https://www.youtube.com/results?search_query=termos+de+busca) e, se souber, canais conhecidos de concurso que explicam isso. Não escreva link de vídeo específico: só links de busca.',
    '',
    'Comece cada questão com "## Questão N — assunto". Fórmulas em LaTeX entre $...$. Não repita o enunciado.'
  ].join('\n')

  const questoes = blocos.join('\n\n')
  // ponytail: Claude segue melhor instruções em tags XML; o ChatGPT, em texto corrido
  return ia === 'claude'
    ? `<pedido>\n${pedido}\n</pedido>\n\n<questoes>\n${questoes}\n</questoes>`
    : `${pedido}\n\n${questoes}`
}

/** o bloco que entra no fim da anotação do tópico */
export function blocoDaRevisao(resposta: string, quando: Date): string {
  const data = quando.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  // títulos da resposta descem um nível, para ficarem dentro da revisão
  const corpo = resposta.trim().replace(/^(#{1,5}) /gm, '#$1 ')
  return `## Revisão de erros — ${data}\n\n${corpo}\n`
}

/** acrescenta a revisão no fim da anotação, sem apagar nada */
export const anotacaoComRevisao = (nota: string, bloco: string): string =>
  nota.trim() ? `${nota.trimEnd()}\n\n${bloco}` : bloco

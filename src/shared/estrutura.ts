import { semAcento } from './texto'
import type { Dados, Id } from './tipos'

/** Um nó lido do texto: nome e filhos */
export interface NoDoTexto {
  nome: string
  filhos: NoDoTexto[]
}

// tudo que vem antes do nome: espaços, desenho de árvore e marcadores
const PREFIXO = /^[\s│├└┬┼─|*•·+-]*(?:\d+(?:\.\d+)*[.)]\s+)?/

/** Lê uma árvore escrita em texto: recuo com espaços ou tab, traços,
 *  marcadores ou o desenho de árvore (├─ │ └─). "A · B · C" numa linha
 *  vira irmãos. Linhas vazias e "```" são ignoradas. */
export function lerEstrutura(texto: string): NoDoTexto[] {
  const raizes: NoDoTexto[] = []
  // pilha de [coluna onde o nome começa, nó]
  const pilha: { coluna: number; no: NoDoTexto }[] = []
  for (const bruta of texto.replace(/\t/g, '    ').split(/\r?\n/)) {
    if (!bruta.trim() || bruta.trim().startsWith('```')) continue
    const prefixo = PREFIXO.exec(bruta)?.[0] ?? ''
    const coluna = prefixo.length
    const nomes = bruta
      .slice(coluna)
      .split(/\s+·\s+/)
      .map((n) => n.trim().replace(/[:;,.]$/, ''))
      .filter(Boolean)
    if (!nomes.length) continue
    while (pilha.length && pilha[pilha.length - 1].coluna >= coluna) pilha.pop()
    const pai = pilha[pilha.length - 1]?.no
    const nos = nomes.map((nome) => ({ nome, filhos: [] as NoDoTexto[] }))
    for (const no of nos) (pai ? pai.filhos : raizes).push(no)
    // o último da linha é quem pode receber filhos nas próximas linhas
    pilha.push({ coluna, no: nos[nos.length - 1] })
  }
  return raizes
}

export interface ResultadoDaImportacao {
  criados: number
  aproveitados: number
}

const igual = (a: string, b: string): boolean => semAcento(a.trim()) === semAcento(b.trim())

/** Junta a árvore lida com o que já existe, sem duplicar: nó com o mesmo
 *  nome (sem ligar para acento e maiúscula) é aproveitado. 1º nível =
 *  matéria, 2º = assunto, dali para baixo = tópicos. */
export function importarEstrutura(
  d: Dados,
  raizes: NoDoTexto[],
  novoId: () => Id,
  quando = Date.now()
): ResultadoDaImportacao {
  const r: ResultadoDaImportacao = { criados: 0, aproveitados: 0 }
  for (const raiz of raizes) {
    let m = d.materias.find((x) => igual(x.nome, raiz.nome))
    if (m) r.aproveitados++
    else {
      m = { id: novoId(), nome: raiz.nome, aberta: true, assuntos: [] }
      d.materias.push(m)
      r.criados++
    }
    for (const filho of raiz.filhos) {
      let a = m.assuntos.find((x) => igual(x.nome, filho.nome))
      if (a) r.aproveitados++
      else {
        a = { id: novoId(), nome: filho.nome, nota: '', atualizadoEm: quando }
        m.assuntos.push(a)
        r.criados++
      }
      const assuntoId = a.id
      const topicos = (nos: NoDoTexto[], paiId: Id | null): void => {
        for (const no of nos) {
          let t = d.topicos.find(
            (x) => x.assuntoId === assuntoId && x.paiId === paiId && igual(x.nome, no.nome)
          )
          if (t) r.aproveitados++
          else {
            t = { id: novoId(), assuntoId, paiId, nome: no.nome, nota: '', atualizadoEm: quando }
            d.topicos.push(t)
            r.criados++
          }
          topicos(no.filhos, t.id)
        }
      }
      topicos(filho.filhos, null)
    }
  }
  return r
}

/** Para colar com uma matéria já escolhida no mapa: se o texto não começa
 *  pela própria matéria, os nós de cima viram assuntos dela. */
export function sobAMateria(raizes: NoDoTexto[], nomeDaMateria: string): NoDoTexto[] {
  if (raizes.length === 1 && igual(raizes[0].nome, nomeDaMateria)) return raizes
  return [{ nome: nomeDaMateria, filhos: raizes }]
}

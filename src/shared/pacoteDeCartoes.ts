import { agendaNova, temLacuna } from './flashcards'
import { importarEstrutura, type NoDoTexto } from './estrutura'
import { semAcento } from './texto'
import { dobrarBarrasDoLatex } from './formulas'
import type { Dados, Id, TipoDeCartao } from './tipos'

/** Um cartão pronto, com o lugar dele no mapa pelo nome
 *  (ex.: ["Sintaxe", "Crase"]). */
export interface CartaoDoPacote {
  lugar: string[]
  frente: string
  verso: string
  tipo: TipoDeCartao
}

export interface PacoteDeCartoes {
  materia: string
  cartoes: CartaoDoPacote[]
}

/** Lê o .json de cartões que o Claude publica na caixa. Cartão sem lugar
 *  ou sem frente é recusado inteiro: melhor avisar do que importar torto. */
export function lerPacoteDeCartoes(
  texto: string
): { ok: true; pacote: PacoteDeCartoes } | { ok: false; erro: string } {
  let bruto: unknown
  try {
    bruto = JSON.parse(dobrarBarrasDoLatex(texto))
  } catch {
    return { ok: false, erro: 'O arquivo de cartões veio quebrado.' }
  }
  const b = bruto as { materia?: unknown; cartoes?: unknown }
  if (typeof b?.materia !== 'string' || !b.materia.trim() || !Array.isArray(b.cartoes))
    return { ok: false, erro: 'O arquivo de cartões não tem matéria ou cartões.' }
  const cartoes: CartaoDoPacote[] = []
  for (const [i, c] of b.cartoes.entries()) {
    const x = c as Partial<CartaoDoPacote>
    const lugar = Array.isArray(x?.lugar)
      ? x.lugar.filter((n) => typeof n === 'string' && n.trim())
      : []
    const frente = typeof x?.frente === 'string' ? x.frente.trim() : ''
    const verso = typeof x?.verso === 'string' ? x.verso.trim() : ''
    const tipo: TipoDeCartao = temLacuna(frente) ? 'lacuna' : 'basico'
    if (!lugar.length || !frente || (tipo === 'basico' && !verso))
      return { ok: false, erro: `O cartão ${i + 1} do arquivo está incompleto.` }
    cartoes.push({ lugar, frente, verso, tipo })
  }
  return { ok: true, pacote: { materia: b.materia.trim(), cartoes } }
}

/** Põe os cartões nos lugares do mapa (criando o lugar que faltar) sem
 *  repetir: cartão com a mesma frente no mesmo lugar é pulado, então
 *  importar de novo não duplica. */
export function importarCartoes(
  d: Dados,
  pacote: PacoteDeCartoes,
  novoId: () => Id,
  quando = Date.now()
): { novos: number; repetidos: number; lugaresCriados: number } {
  // os lugares entram pelo mesmo caminho de "Colar estrutura"
  const raiz: NoDoTexto = { nome: pacote.materia, filhos: [] }
  for (const c of pacote.cartoes) {
    let nivel = raiz.filhos
    for (const nome of c.lugar) {
      let no = nivel.find((n) => semAcento(n.nome) === semAcento(nome))
      if (!no) nivel.push((no = { nome, filhos: [] }))
      nivel = no.filhos
    }
  }
  const { criados } = importarEstrutura(d, [raiz], novoId, quando)

  const m = d.materias.find((x) => semAcento(x.nome) === semAcento(pacote.materia))!
  const acharLugar = (lugar: string[]): Id | null => {
    const a = m.assuntos.find((x) => semAcento(x.nome) === semAcento(lugar[0]))
    if (!a) return null
    let id: Id = a.id
    let paiId: Id | null = null
    for (const nome of lugar.slice(1)) {
      const t = d.topicos.find(
        (x) => x.assuntoId === a.id && x.paiId === paiId && semAcento(x.nome) === semAcento(nome)
      )
      if (!t) return null
      id = paiId = t.id
    }
    return id
  }

  let novos = 0
  let repetidos = 0
  for (const c of pacote.cartoes) {
    const lugarId = acharLugar(c.lugar)
    if (!lugarId) continue
    // com acento: "por" e "pôr" são cartões diferentes (só o lugar ignora acento)
    const igual = d.cartoes.some((x) => x.assuntoId === lugarId && x.frente.trim() === c.frente)
    if (igual) {
      repetidos++
      continue
    }
    d.cartoes.push({
      id: novoId(),
      assuntoId: lugarId,
      tipo: c.tipo,
      frente: c.frente,
      verso: c.verso,
      agenda: agendaNova(new Date(quando)),
      criadoEm: quando + novos // a ordem do arquivo vira a ordem de criação
    })
    novos++
  }
  return { novos, repetidos, lugaresCriados: criados }
}

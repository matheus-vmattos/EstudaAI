import { novoId, type Mudar } from './useDados'
import { importarEstrutura, lerEstrutura, recolherAbaixoDosAssuntos } from '../../shared/estrutura'
import { lerRespostaDaIa } from '../../shared/questoes'
import { importarCartoes, lerPacoteDeCartoes } from '../../shared/pacoteDeCartoes'
import { importarEdital, lerPacoteDeEdital, simuladoDaCaixa } from '../../shared/edital'
import { continuarMissao, lerPacoteDeMissao } from '../../shared/missao'
import { importarAnotacoes, lerPacoteDeAnotacoes } from '../../shared/anotacoesDoClaude'
import type { Dados, Id, ItemDaCaixa } from '../../shared/tipos'

export type ResultadoDaCaixa = {
  ok: boolean
  texto: string
  simulado?: Id
  /** os nós das anotações do pacote (para abrir a primeira) */
  nos?: Id[]
  /** a frente dos cartões do pacote (a missão usa para saber quando terminou) */
  frentes?: string[]
}

/** Baixa um item da caixa "Do Claude" e põe nos dados. Serve à tela Do Claude
 *  e às tarefas da missão (que importam o item ao começar). As contagens saem
 *  de uma cópia: o mudar do React pode rodar depois. */
export async function importarDaCaixa(
  item: ItemDaCaixa,
  dados: Dados,
  mudar: Mudar
): Promise<ResultadoDaCaixa> {
  const r = await window.api.caixaArquivo(item.arquivo)
  if ('erro' in r) return { ok: false, texto: r.erro }
  const marcar = (d: Dados): void => {
    d.caixaImportados = [...new Set([...(d.caixaImportados ?? []), item.id])]
  }

  if (item.tipo === 'estrutura') {
    const raizes = lerEstrutura(r.texto)
    const res = importarEstrutura(structuredClone(dados), raizes, novoId)
    mudar((d) => {
      recolherAbaixoDosAssuntos(d, importarEstrutura(d, raizes, novoId).materias)
      marcar(d)
    })
    return { ok: true, texto: `✓ ${res.criados} criados · ${res.aproveitados} já existiam` }
  }
  if (item.tipo === 'edital') {
    const lido = lerPacoteDeEdital(r.texto)
    if (!lido.ok) return { ok: false, texto: lido.erro }
    const res = importarEdital(structuredClone(dados), lido.pacote, novoId)
    mudar((d) => {
      importarEdital(d, lido.pacote, novoId)
      marcar(d)
    })
    return {
      ok: true,
      texto:
        `✓ Edital ligado: ${res.materias} matérias` +
        (res.criadas ? ` (${res.criadas} novas, importe também o mapa)` : '')
    }
  }
  if (item.tipo === 'cartoes') {
    const lido = lerPacoteDeCartoes(r.texto)
    if (!lido.ok) return { ok: false, texto: lido.erro }
    const quando = Date.now()
    const res = importarCartoes(structuredClone(dados), lido.pacote, novoId, quando)
    mudar((d) => {
      importarCartoes(d, lido.pacote, novoId, quando)
      marcar(d)
    })
    return {
      ok: true,
      frentes: lido.pacote.cartoes.map((c) => c.frente.trim()),
      texto:
        `✓ ${res.novos} cartões novos` +
        (res.corrigidos ? ` · ${res.corrigidos} corrigidos` : '') +
        (res.repetidos ? ` · ${res.repetidos} já existiam` : '') +
        (res.lugaresCriados ? ` · ${res.lugaresCriados} lugares novos no mapa` : '')
    }
  }
  if (item.tipo === 'anotacoes') {
    const lido = lerPacoteDeAnotacoes(r.texto)
    if (!lido.ok) return { ok: false, texto: lido.erro }
    // os mesmos ids na cópia (que conta e devolve os nós) e na gravação
    const ids: Id[] = []
    let k = 0
    const mesmoId = (): Id => (ids[k++] ??= novoId())
    const res = importarAnotacoes(structuredClone(dados), lido.pacote, mesmoId)
    mudar((d) => {
      k = 0
      importarAnotacoes(d, lido.pacote, mesmoId)
      marcar(d)
    })
    return {
      ok: true,
      nos: res.nos,
      texto:
        `✓ ${res.escritas} anotações` +
        (res.suas ? ` · ${res.suas} suas ficaram como estavam` : '') +
        (res.lugaresCriados ? ` · ${res.lugaresCriados} lugares novos no mapa` : '')
    }
  }
  if (item.tipo === 'missao') {
    const lido = lerPacoteDeMissao(r.texto, item.id, Date.now())
    if (!lido.ok) return { ok: false, texto: lido.erro }
    mudar((d) => {
      d.missao = continuarMissao(lido.missao, d.missao)
      marcar(d)
    })
    return {
      ok: true,
      texto: `✓ Missão da semana no Meu edital (${lido.missao.tarefas.length} tarefas)`
    }
  }
  const leitura = lerRespostaDaIa(r.texto)
  if (!leitura.ok) return { ok: false, texto: leitura.erro }
  const n = leitura.questoes.length
  const simulado = simuladoDaCaixa(dados, leitura, item.titulo, novoId(), Date.now())
  mudar((d) => {
    d.simulados.push(simulado)
    marcar(d)
  })
  return { ok: true, texto: `✓ ${n} questões no histórico (${n * 3} min)`, simulado: simulado.id }
}

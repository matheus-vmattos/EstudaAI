import { useRef, useState, type FormEvent } from 'react'
import { Icone } from '../Icone'
import { Confirmar } from '../Confirmar'
import { EscolherLugar } from '../EscolherLugar'
import { novoId, type Mudar } from '../useDados'
import type { AlvoDaRevisao } from '../App'
import {
  agendaNova,
  ehNovo,
  filaDoDia,
  formatarIntervalo,
  mostrarLacuna,
  proximoAprendendo,
  temLacuna
} from '../../../shared/flashcards'
import type { Cartao, Dados, Id, TipoDeCartao } from '../../../shared/tipos'
import { idsAbaixo, nosDaMateria, todosOsNos } from '../../../shared/arvore'

type Rascunho = { id: Id | null; tipo: TipoDeCartao; frente: string; verso: string; assuntoId: Id }

export function Flashcards({
  dados,
  mudar,
  agora,
  estudar
}: {
  dados: Dados
  mudar: Mudar
  agora: Date
  estudar: (alvo: AlvoDaRevisao) => void
}) {
  // assuntos e tópicos: todo lugar da árvore pode ter cartões
  const assuntos = todosOsNos(dados)
  const vazio = (assuntoId = assuntos[0]?.id ?? ''): Rascunho => ({
    id: null,
    tipo: 'basico',
    frente: '',
    verso: '',
    assuntoId
  })
  const [rascunho, setRascunho] = useState<Rascunho>(() => vazio())
  const [erro, setErro] = useState('')
  const [salvo, setSalvo] = useState(false)
  const [aberto, setAberto] = useState<Id | null>(null)
  const [apagando, setApagando] = useState<Cartao | null>(null)
  const textoRef = useRef<HTMLTextAreaElement>(null)

  const fila = filaDoDia(dados.cartoes, agora)
  const paraHoje = fila.revisar.length + fila.novos.length
  const naFila = new Set([...fila.revisar, ...fila.novos].map((c) => c.id))
  const contar = (ids: Set<Id>): { novos: number; revisar: number; total: number } => {
    const cs = dados.cartoes.filter((c) => ids.has(c.assuntoId))
    return {
      novos: cs.filter((c) => ehNovo(c)).length,
      revisar: cs.filter((c) => !ehNovo(c) && naFila.has(c.id)).length,
      total: cs.length
    }
  }
  // seta ao contrário do padrão (matéria aberta; assunto e tópico fechados)
  const invertidos = new Set(dados.baralhosInvertidos ?? [])
  const alternar = (id: Id): void =>
    mudar((d) => {
      const atual = new Set(d.baralhosInvertidos ?? [])
      if (atual.has(id)) atual.delete(id)
      else atual.add(id)
      d.baralhosInvertidos = [...atual]
    })
  const proximo = paraHoje === 0 ? proximoAprendendo(dados.cartoes, agora) : null

  const muda = <K extends keyof Rascunho>(k: K, v: Rascunho[K]): void => {
    setRascunho((r) => ({ ...r, [k]: v }))
    setSalvo(false)
    setErro('')
  }

  /** lacuna: envolve o trecho selecionado em {{c1::...}} */
  const esconderSelecao = (): void => {
    const el = textoRef.current
    if (!el) return
    const { selectionStart: i, selectionEnd: f, value } = el
    if (i === f) {
      setErro('Selecione no texto o trecho que vai ficar escondido.')
      return
    }
    muda('frente', `${value.slice(0, i)}{{c1::${value.slice(i, f)}}}${value.slice(f)}`)
  }

  const guardar = (e: FormEvent): void => {
    e.preventDefault()
    const frente = rascunho.frente.trim()
    const verso = rascunho.verso.trim()
    if (!rascunho.assuntoId) return setErro('Escolha o assunto do cartão.')
    if (!frente) return setErro('O cartão precisa de uma frente.')
    if (rascunho.tipo === 'basico' && !verso) return setErro('O cartão precisa de um verso.')
    if (rascunho.tipo === 'lacuna' && !temLacuna(frente))
      return setErro('Selecione um trecho e use "Esconder trecho" para criar a lacuna.')
    mudar((d) => {
      const existente = d.cartoes.find((c) => c.id === rascunho.id)
      if (existente)
        Object.assign(existente, {
          tipo: rascunho.tipo,
          frente,
          verso,
          assuntoId: rascunho.assuntoId
        })
      else
        d.cartoes.push({
          id: novoId(),
          assuntoId: rascunho.assuntoId,
          tipo: rascunho.tipo,
          frente,
          verso,
          agenda: agendaNova(),
          criadoEm: Date.now()
        })
    })
    setRascunho({ ...vazio(rascunho.assuntoId), tipo: rascunho.tipo })
    setSalvo(true)
  }

  const cartoesAbertos = aberto ? dados.cartoes.filter((c) => c.assuntoId === aberto) : []

  return (
    <div className="tela">
      <main className="conteudo">
        <header className="cabecalho">
          <div>
            <div className="trilha">Flashcards / Hoje</div>
            <h1 className="titulo">Flashcards</h1>
          </div>
          {paraHoje > 0 ? (
            <button
              type="button"
              className="botao principal grande"
              onClick={() => estudar({ assuntos: null, titulo: 'Todos os baralhos' })}
            >
              Estudar agora <span className="numero-ciano">{paraHoje}</span>
            </button>
          ) : (
            <span className="meta">
              {dados.cartoes.length === 0
                ? ''
                : proximo
                  ? `Tudo em dia · próximo em ${formatarIntervalo(new Date(proximo.agenda.due).getTime() - agora.getTime())}`
                  : '✓ Tudo em dia por hoje'}
            </span>
          )}
        </header>

        <div className="colunas">
          <section
            aria-labelledby="titulo-baralhos"
            style={{
              flex: '2 1 480px',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}
          >
            <h2 id="titulo-baralhos" className="secao">
              Baralhos
            </h2>
            {dados.cartoes.length === 0 ? (
              <p className="meta">Nenhum cartão ainda.</p>
            ) : (
              <div className="baralhos" role="table" aria-label="Baralhos">
                <div role="row" className="cabeca">
                  <span role="columnheader">Assunto</span>
                  <span role="columnheader">Novos</span>
                  <span role="columnheader">Revisar</span>
                  <span role="columnheader">Total</span>
                  <span role="columnheader" />
                </div>
                {dados.materias.map((m) => {
                  const nos = nosDaMateria(dados, m)
                  const ids = new Set(nos.map((n) => n.id))
                  const t = contar(ids)
                  if (t.total === 0) return null
                  // cada linha conta o nó e o que está abaixo dele; nó sem
                  // cartão não aparece (cria-se cartão nele pelo formulário)
                  const contas = new Map(
                    nos.map((n) => {
                      const abaixo = idsAbaixo(dados, n.id)
                      return [n.id, { abaixo, ...contar(new Set(abaixo)) }]
                    })
                  )
                  const temFilhoComCartao = new Set(
                    nos.filter((n) => n.paiId && contas.get(n.id)!.total > 0).map((n) => n.paiId!)
                  )
                  const materiaAberta = !invertidos.has(m.id)
                  const visivel = new Map<Id, boolean>()
                  for (const n of nos)
                    visivel.set(
                      n.id,
                      n.paiId === null
                        ? materiaAberta
                        : !!visivel.get(n.paiId) && invertidos.has(n.paiId)
                    )
                  return (
                    <div key={m.id} role="rowgroup">
                      <div role="row" className="materia-linha">
                        <span role="cell" className="nome-baralho">
                          <SetaDoBaralho
                            aberta={materiaAberta}
                            nome={m.nome}
                            alternar={() => alternar(m.id)}
                          />
                          {m.nome}
                        </span>
                        <span role="cell" className="n-novo">
                          {t.novos}
                        </span>
                        <span role="cell" className="n-revisar">
                          {t.revisar}
                        </span>
                        <span role="cell" className="n-total">
                          {t.total}
                        </span>
                        <span role="cell">
                          <button
                            type="button"
                            className="link-botao"
                            onClick={() => estudar({ assuntos: [...ids], titulo: m.nome })}
                          >
                            Estudar
                          </button>
                        </span>
                      </div>
                      {nos.map((a) => {
                        const c = contas.get(a.id)!
                        if (c.total === 0 || !visivel.get(a.id)) return null
                        return (
                          <div
                            key={a.id}
                            role="row"
                            className="assunto-linha"
                            aria-current={aberto === a.id ? 'true' : undefined}
                            style={{ marginLeft: 20 + a.nivel * 18 }}
                          >
                            <span role="cell" className="nome-baralho">
                              {temFilhoComCartao.has(a.id) ? (
                                <SetaDoBaralho
                                  aberta={invertidos.has(a.id)}
                                  nome={a.nome}
                                  alternar={() => alternar(a.id)}
                                />
                              ) : (
                                <span className="seta-baralho" aria-hidden="true" />
                              )}
                              <button
                                type="button"
                                className="link-botao texto"
                                onClick={() => {
                                  setAberto(aberto === a.id ? null : a.id)
                                  // o cartão novo vai para o baralho que você está vendo
                                  if (!rascunho.id && aberto !== a.id)
                                    setRascunho((r) => ({ ...r, assuntoId: a.id }))
                                }}
                                aria-expanded={aberto === a.id}
                              >
                                {a.nome}
                              </button>
                            </span>
                            <span role="cell" className="n-novo">
                              {c.novos}
                            </span>
                            <span role="cell" className="n-revisar">
                              {c.revisar}
                            </span>
                            <span role="cell" className="n-total">
                              {c.total}
                            </span>
                            <span role="cell">
                              <button
                                type="button"
                                className="link-botao"
                                onClick={() =>
                                  estudar({
                                    assuntos: c.abaixo,
                                    titulo: `${m.nome} › ${a.caminho.join(' › ')}`
                                  })
                                }
                              >
                                Estudar
                              </button>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}

            {aberto && (
              <section aria-label="Cartões do assunto" className="lista-cartoes">
                {cartoesAbertos.length === 0 && (
                  <p className="meta">Nenhum cartão neste assunto ainda.</p>
                )}
                {cartoesAbertos.map((c) => {
                  const frente = c.tipo === 'lacuna' ? mostrarLacuna(c.frente).frente : c.frente
                  const quando = new Date(c.agenda.due).getTime() - agora.getTime()
                  return (
                    <div key={c.id} className="linha-cartao">
                      <span className="frente">{frente}</span>
                      <span className="meta">
                        {ehNovo(c)
                          ? 'novo'
                          : quando <= 0
                            ? 'hoje'
                            : `em ${formatarIntervalo(quando)}`}
                      </span>
                      <button
                        type="button"
                        className="botao-icone"
                        aria-label="Editar cartão"
                        title="Editar"
                        onClick={() => {
                          setRascunho({
                            id: c.id,
                            tipo: c.tipo,
                            frente: c.frente,
                            verso: c.verso,
                            assuntoId: c.assuntoId
                          })
                          setSalvo(false)
                        }}
                      >
                        <Icone nome="lapis" tamanho={15} />
                      </button>
                      <button
                        type="button"
                        className="botao-icone"
                        aria-label="Apagar cartão"
                        title="Apagar"
                        onClick={() => setApagando(c)}
                      >
                        <Icone nome="lixo" tamanho={15} />
                      </button>
                    </div>
                  )
                })}
              </section>
            )}
          </section>

          <form className="form-cartao" aria-labelledby="titulo-novo" onSubmit={guardar}>
            <h2 id="titulo-novo" className="secao">
              {rascunho.id ? 'Editar cartão' : 'Novo cartão'}
            </h2>
            <div
              role="radiogroup"
              aria-label="Tipo de cartão"
              className="opcoes"
              style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
            >
              {(['basico', 'lacuna'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={rascunho.tipo === t}
                  className="opcao"
                  onClick={() => muda('tipo', t)}
                >
                  {t === 'basico' ? 'Frente / verso' : 'Lacuna'}
                </button>
              ))}
            </div>
            <label className="campo">
              {rascunho.tipo === 'basico' ? 'Frente' : 'Texto'}
              <textarea
                ref={textoRef}
                rows={3}
                value={rascunho.frente}
                placeholder={
                  rascunho.tipo === 'basico'
                    ? 'Quando a próclise é obrigatória?'
                    : 'Próclise é obrigatória com palavras atrativas.'
                }
                onChange={(e) => muda('frente', e.target.value)}
              />
            </label>
            {rascunho.tipo === 'lacuna' && (
              <button
                type="button"
                className="botao"
                style={{ alignSelf: 'flex-start' }}
                onClick={esconderSelecao}
              >
                Esconder trecho selecionado
              </button>
            )}
            <label className="campo">
              {rascunho.tipo === 'basico' ? 'Verso' : 'Extra (opcional)'}
              <textarea
                rows={3}
                value={rascunho.verso}
                onChange={(e) => muda('verso', e.target.value)}
              />
            </label>
            <EscolherLugar
              dados={dados}
              rotulo="Onde guardar"
              valor={rascunho.assuntoId}
              aoEscolher={(id) => muda('assuntoId', id)}
            />
            {erro && (
              <div className="aviso erro" role="alert">
                {erro}
              </div>
            )}
            {salvo && <div className="aviso ok">✓ Cartão guardado</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="submit"
                className="botao principal"
                style={{ flex: 1 }}
                disabled={assuntos.length === 0}
              >
                {rascunho.id ? 'Salvar cartão' : 'Guardar cartão'}
              </button>
              {rascunho.id && (
                <button
                  type="button"
                  className="botao"
                  style={{ minHeight: 44 }}
                  onClick={() => setRascunho(vazio(rascunho.assuntoId))}
                >
                  Cancelar
                </button>
              )}
            </div>
            <p className="meta" style={{ margin: 0, lineHeight: 1.6 }}>
              Na anotação: selecione um trecho › Virar flashcard
            </p>
          </form>
        </div>
      </main>

      {apagando && (
        <Confirmar
          titulo="Apagar este cartão?"
          texto="O cartão e o histórico de revisões dele somem."
          botao="Apagar"
          aoConfirmar={() => {
            const id = apagando.id
            setApagando(null)
            mudar((d) => {
              d.cartoes = d.cartoes.filter((c) => c.id !== id)
            })
            if (rascunho.id === id) setRascunho(vazio(rascunho.assuntoId))
          }}
          aoCancelar={() => setApagando(null)}
        />
      )}
    </div>
  )
}

function SetaDoBaralho({
  aberta,
  nome,
  alternar
}: {
  aberta: boolean
  nome: string
  alternar: () => void
}) {
  return (
    <button
      type="button"
      className="seta-baralho"
      aria-expanded={aberta}
      aria-label={`${aberta ? 'Recolher' : 'Abrir'} ${nome}`}
      onClick={alternar}
    >
      <Icone nome={aberta ? 'abaixo' : 'direita'} tamanho={14} />
    </button>
  )
}

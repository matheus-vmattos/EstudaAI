import { useState } from 'react'
import { Icone } from './Icone'
import { Texto } from './Texto'
import type { Mudar } from './useDados'
import { estadoDaResposta, retornoDe, type EstadoDaResposta } from '../../shared/explicar'
import type { Dados, Explicacao, Id, Retorno } from '../../shared/tipos'

export const NOME_DO_ESTADO: Record<EstadoDaResposta, string> = {
  esperando: 'Esperando o Claude',
  nova: 'Resposta nova',
  entendeu: 'Entendido',
  rever: 'Rever'
}

export function EstadoDaResposta({ estado }: { estado: EstadoDaResposta }) {
  return <span className={`veredito ${estado}`}>{NOME_DO_ESTADO[estado]}</span>
}

/** A resposta do Claude a uma explicação: o que você acertou, o que pode ter
 *  escapado (com o porquê) e um teste rápido só sobre isso. Acertar o teste
 *  fecha o assunto; errar deixa para rever (volta no próximo simulado). */
export function RespostaDoClaude(props: { dados: Dados; mudar: Mudar; explicacao: Explicacao }) {
  const r = retornoDe(props.dados, props.explicacao)
  // resposta nova do Claude (outra data) é outro teste: começa do zero
  return r ? <Licao key={`${props.explicacao.id}-${r.criadoEm}`} {...props} r={r} /> : null
}

function Licao({
  dados,
  mudar,
  explicacao: x,
  r
}: {
  dados: Dados
  mudar: Mudar
  explicacao: Explicacao
  r: Retorno
}) {
  const feito = x.licao?.retornoEm === r.criadoEm ? x.licao : undefined
  const [escolhas, setEscolhas] = useState<string[]>(feito?.respostas ?? [])
  const l = r.licao
  const teste = l?.teste ?? []
  const estado = estadoDaResposta(dados, x)

  const gravar = (respostas: string[]): void =>
    mudar((d) => {
      const y = d.explicacoes?.find((e) => e.id === x.id)
      if (y) y.licao = { retornoEm: r.criadoEm, respostas, em: Date.now() }
    })
  const responder = (i: number, letra: string): void => {
    if (escolhas[i]) return
    const novas = [...escolhas]
    novas[i] = letra
    setEscolhas(novas)
    if (teste.every((_, k) => novas[k])) gravar(novas)
  }

  return (
    <div className="resposta-claude">
      {l ? (
        <>
          <p className="resp-acertou">
            <Icone nome="check" tamanho={16} />
            <span>
              <Texto texto={l.acertou} />
            </span>
          </p>
          {l.pontos.length > 0 && (
            <section className="resp-bloco" aria-label="O que pode ter escapado">
              <h3 className="rotulo-retorno">O que pode ter escapado</h3>
              <ol className="resp-pontos">
                {l.pontos.map((p) => (
                  <li key={p.titulo}>
                    <strong>{p.titulo}</strong>
                    <span>
                      <Texto texto={p.texto} />
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      ) : (
        <p className="resp-texto">
          <Texto texto={r.texto} />
        </p>
      )}

      {teste.length > 0 && (
        <section className="resp-bloco" aria-label="Teste rápido">
          <h3 className="rotulo-retorno">
            Teste rápido{teste.length > 1 ? ` · ${teste.length} questões` : ''}
          </h3>
          {teste.map((q, i) => {
            const minha = escolhas[i]
            return (
              <div key={i} className="resp-questao">
                <p className="enunciado">
                  <Texto texto={q.enunciado} />
                </p>
                <div
                  role="radiogroup"
                  aria-label={`Alternativas da questão ${i + 1}`}
                  className="resp-alternativas"
                >
                  {q.alternativas.map((a) => {
                    const classe = !minha
                      ? ''
                      : a.letra === q.gabarito
                        ? 'certa'
                        : a.letra === minha
                          ? 'errada'
                          : 'apagada'
                    return (
                      <button
                        key={a.letra}
                        type="button"
                        role="radio"
                        aria-checked={minha === a.letra}
                        disabled={!!minha}
                        className={`alternativa ${classe}`}
                        onClick={() => responder(i, a.letra)}
                      >
                        <span className="letra">{a.letra}</span>
                        <span>
                          <Texto texto={a.texto} />
                        </span>
                      </button>
                    )
                  })}
                </div>
                {minha && (
                  <p className={`resp-comentario ${minha === q.gabarito ? 'bom' : 'ruim'}`}>
                    {minha === q.gabarito ? 'Certo. ' : `Era ${q.gabarito}. `}
                    <Texto
                      texto={
                        minha !== q.gabarito && q.comentarios?.[minha]
                          ? `${q.comentarios[minha]} ${q.resolucao}`
                          : q.resolucao
                      }
                    />
                  </p>
                )}
              </div>
            )
          })}
        </section>
      )}

      {estado === 'entendeu' && feito && (
        <p className="meta nota-boa" role="status">
          Entendido: este assunto fecha.
        </p>
      )}
      {estado === 'rever' && teste.length > 0 && (
        <p className="meta resp-rever" role="status">
          Fica para rever: ele volta no próximo simulado, e no próximo check-in eu explico de outro
          jeito.
        </p>
      )}
      {!teste.length && estado === 'nova' && (
        <div>
          <button type="button" className="botao principal" onClick={() => gravar([])}>
            Entendi
          </button>
        </div>
      )}
      {l && l.fontes.length > 0 && (
        <p className="meta resp-fontes">Fontes: {l.fontes.join(' · ')}</p>
      )}
    </div>
  )
}

/** As respostas do Claude numa lista: no Meu edital só as novas (some quando
 *  não há nada); nas Anotações, todas, para reler. */
export function ListaDeRespostas({
  dados,
  mudar,
  todas = false
}: {
  dados: Dados
  mudar: Mudar
  todas?: boolean
}) {
  const [aberta, setAberta] = useState<Id | null>(null)
  // a que você abriu fica até sair da tela: fazer o teste (ou "Entendi") não a
  // tira da frente antes de você ler o resultado, chegue ela quando chegar
  const [abertas, setAbertas] = useState<ReadonlySet<Id>>(new Set())
  const ORDEM: EstadoDaResposta[] = ['nova', 'rever', 'entendeu']
  const itens = (dados.explicacoes ?? [])
    .filter((x) => x.texto.trim())
    .map((x) => ({ x, estado: estadoDaResposta(dados, x) }))
    .filter(({ x, estado }) =>
      todas ? estado !== 'esperando' : estado === 'nova' || abertas.has(x.id)
    )
    .sort(
      (a, b) =>
        ORDEM.indexOf(a.estado) - ORDEM.indexOf(b.estado) ||
        (retornoDe(dados, b.x)?.criadoEm ?? 0) - (retornoDe(dados, a.x)?.criadoEm ?? 0)
    )
  if (!itens.length && !todas) return null
  return (
    <section aria-labelledby="t-respostas" className="estudo-do-dia">
      <div className="cabeca-dia">
        <h2 id="t-respostas" className="secao">
          {todas ? 'Respostas do Claude' : 'O Claude respondeu'}
        </h2>
        <span className="meta">
          {todas
            ? `${itens.length} ${itens.length === 1 ? 'resposta' : 'respostas'}`
            : `${itens.length} ${itens.length === 1 ? 'explicação sua' : 'explicações suas'}`}
        </span>
      </div>
      {todas && !itens.length && (
        <p className="meta">Quando o Claude responder uma explicação sua, ela fica aqui.</p>
      )}
      {itens.map(({ x, estado }) => (
        <div key={x.id} className={`item-resposta ${aberta === x.id ? 'aberto' : ''}`}>
          <button
            type="button"
            className="linha-resposta"
            aria-expanded={aberta === x.id}
            onClick={() => {
              setAberta(aberta === x.id ? null : x.id)
              setAbertas((a) => new Set(a).add(x.id))
            }}
          >
            <span className="nome">{x.topico}</span>
            <EstadoDaResposta estado={estado} />
            <Icone nome={aberta === x.id ? 'abaixo' : 'direita'} tamanho={14} />
          </button>
          {aberta === x.id && (
            <div className="corpo-resposta">
              <p className="pergunta-explique">{x.pergunta}</p>
              <p className="sua-explicacao">“{x.texto}”</p>
              <RespostaDoClaude dados={dados} mudar={mudar} explicacao={x} />
            </div>
          )}
        </div>
      ))}
    </section>
  )
}

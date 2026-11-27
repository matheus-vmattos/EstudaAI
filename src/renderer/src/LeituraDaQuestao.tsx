import { useState, type ReactNode } from 'react'
import { Texto } from './Texto'
import { marcar, paragrafos, pedacos, type EnunciadoLido, type Trecho } from '../../shared/leitura'

/** O enunciado já separado: o pedido, os itens um por linha e o comando
 *  ("Está correto o que se afirma APENAS em") com as palavras-chave em
 *  destaque (mockup "Leitura da questão", 27/11). */
export function Enunciado({ lido }: { lido: EnunciadoLido }) {
  return (
    <div className="enunciado">
      {lido.antes && (
        <p>
          <Texto texto={lido.antes} comando />
        </p>
      )}
      {lido.itens.length > 0 && (
        <ol className="itens-da-questao">
          {lido.itens.map((it, i) => (
            <li key={i}>
              <b>{it.marca}</b>
              <span>
                <Texto texto={it.texto} comando />
              </span>
            </li>
          ))}
        </ol>
      )}
      {lido.depois && (
        <p>
          <Texto texto={lido.depois} comando />
        </p>
      )}
    </div>
  )
}

/** O texto de apoio com os parágrafos numerados. Com o marca-texto ligado,
 *  selecionar um trecho marca; clicar num trecho marcado desmarca. */
export function TextoDeApoio({
  apoio,
  faixa,
  trechos,
  marcando,
  mudarTrechos
}: {
  apoio: string
  /** "vale para as questões 11 a 15" */
  faixa?: [number, number]
  trechos: Trecho[]
  marcando?: boolean
  mudarTrechos?: (t: Trecho[]) => void
}) {
  const soltar = (): void => {
    if (!marcando || !mudarTrechos) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.rangeCount) return
    const r = sel.getRangeAt(0)
    const a = posicao(r.startContainer, r.startOffset)
    const b = posicao(r.endContainer, r.endOffset)
    sel.removeAllRanges()
    if (a === null || b === null) return
    mudarTrechos(marcar(trechos, [a, b]))
  }
  return (
    <section className="texto-apoio" aria-label="Texto de apoio">
      <h2 className="secao">
        Texto
        {faixa && faixa[1] > faixa[0] && (
          <span className="meta">
            Vale para as questões {faixa[0]} a {faixa[1]}
          </span>
        )}
      </h2>
      <div className={`paragrafos ${marcando ? 'marcando' : ''}`} onMouseUp={soltar}>
        {paragrafos(apoio).map((p, i) => (
          <p key={p.ini}>
            <b aria-hidden="true">{i + 1}</b>
            <span>
              {pedacos(p.ini, p.texto, trechos).map((x) =>
                x.marcado ? (
                  <mark
                    key={x.ini}
                    data-ini={x.ini}
                    title={marcando ? 'Clique para desmarcar' : undefined}
                    onClick={() => {
                      if (!marcando || !mudarTrechos) return
                      if (!window.getSelection()?.isCollapsed) return
                      mudarTrechos(trechos.filter(([a, b]) => !(a <= x.ini && x.ini < b)))
                    }}
                  >
                    {x.texto}
                  </mark>
                ) : (
                  <span key={x.ini} data-ini={x.ini}>
                    {x.texto}
                  </span>
                )
              )}
            </span>
          </p>
        ))}
      </div>
    </section>
  )
}

// posição no texto de apoio: cada pedaço guarda onde começa (data-ini)
function posicao(no: Node, offset: number): number | null {
  const el = no.nodeType === Node.TEXT_NODE ? no.parentElement : (no as Element)
  const pedaco = el?.closest('[data-ini]')
  if (!pedaco) return null
  const ini = Number(pedaco.getAttribute('data-ini'))
  return no.nodeType === Node.TEXT_NODE ? ini + offset : ini
}

// ponytail: o tamanho da letra é deste PC (como o zoom do navegador); não
// precisa ir para a nuvem nem para o arquivo de dados
const CHAVE_LETRA = 'estudaai.letraDaQuestao'
const LETRA_PADRAO = 18
const ler = (): number => {
  try {
    const n = Number(localStorage.getItem(CHAVE_LETRA))
    return n >= 14 && n <= 26 ? n : LETRA_PADRAO
  } catch {
    return LETRA_PADRAO
  }
}

/** A−/A+: o tamanho da letra das questões, guardado para as próximas vezes */
export function useLetraDaQuestao(): [number, ReactNode] {
  const [tam, setTam] = useState(ler)
  const mudar = (d: number): void => {
    const n = Math.min(26, Math.max(14, tam + d))
    setTam(n)
    try {
      localStorage.setItem(CHAVE_LETRA, String(n))
    } catch {
      /* sem armazenamento: vale só nesta abertura */
    }
  }
  const botoes = (
    <div className="botoes-letra" role="group" aria-label="Tamanho da letra">
      <button
        type="button"
        className="botao"
        aria-label="Diminuir letra"
        disabled={tam <= 14}
        onClick={() => mudar(-1)}
      >
        A−
      </button>
      <button
        type="button"
        className="botao"
        aria-label="Aumentar letra"
        disabled={tam >= 26}
        onClick={() => mudar(1)}
      >
        A+
      </button>
    </div>
  )
  return [tam, botoes]
}

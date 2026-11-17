import { formatarTempo } from '../../../shared/questoes'
import {
  ajusteSugerido,
  type AjusteDeNivel,
  type Diagnostico,
  type Foco,
  type OpcoesAdaptadas
} from '../../../shared/adaptado'

const NOMES_DO_AJUSTE: Record<AjusteDeNivel, string> = {
  descer: '↓ Descer',
  manter: '= Manter',
  subir: '↑ Subir'
}
const NOMES_DO_FOCO: Record<Foco, string> = {
  equilibrado: 'Equilibrado',
  edital: 'Edital e banca',
  base: 'Base teórica'
}
const POR_QUE: Record<AjusteDeNivel, string> = {
  subir: 'Sugerido: subir (acertou 80% ou mais)',
  manter: 'Sugerido: manter (entre 50% e 80%)',
  descer: 'Sugerido: descer (abaixo de 50%)'
}

/** Coluna da esquerda do gerador no modo "próximo simulado adaptado" */
export function PainelAdaptado({
  diagnostico: d,
  opcoes: o,
  mudar
}: {
  diagnostico: Diagnostico
  opcoes: OpcoesAdaptadas
  mudar: (o: OpcoesAdaptadas) => void
}) {
  const muda = <K extends keyof OpcoesAdaptadas>(k: K, v: OpcoesAdaptadas[K]): void =>
    mudar({ ...o, [k]: v })
  // erro ou acerto com dúvida (marcou "p/ revisar"): os dois entram no reforço
  const errados = d.porTopico.filter((t) => t.erros > 0 || t.duvidas > 0)
  const nErradas = d.total - d.acertos
  const nDuvidas =
    d.porTopico.reduce((n, t) => n + t.duvidas, 0) +
    (d.porTopico.length ? 0 : d.duvidasSemTopico.length)
  const paraReforcar = nErradas + nDuvidas
  const corDaNota = d.pct >= 70 ? 'nota-boa' : d.pct >= 50 ? 'nota-media' : 'nota-ruim'

  return (
    <div className="form-gerador">
      <section className="bloco-explicacao conceito" aria-labelledby="titulo-desempenho">
        <h2 id="titulo-desempenho" className="secao">
          Seu desempenho
        </h2>
        <div className="placar" style={{ gap: 24 }}>
          <div>
            <span className="meta">Acertos</span>
            <span className={`numero ${corDaNota}`} style={{ fontSize: 28 }}>
              {d.acertos}/{d.total}
            </span>
          </div>
          <div>
            <span className="meta">Média/questão</span>
            <span className="numero" style={{ fontSize: 28 }}>
              {formatarTempo(d.mediaMs)}
            </span>
          </div>
        </div>
        {errados.length > 0 && (
          <div className="lista-erros">
            <span className="meta">Onde você errou ou ficou na dúvida</span>
            {errados.map((t) => (
              <span key={t.topico} className="linha-erro">
                <span>{t.topico}</span>
                <span className="erros">
                  {[
                    t.erros > 0 && `${t.erros} ${t.erros === 1 ? 'erro' : 'erros'}`,
                    t.duvidas > 0 && `${t.duvidas} com dúvida`
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            ))}
          </div>
        )}
        {errados.length === 0 && d.erradasSemTopico.length > 0 && (
          <p className="meta" style={{ margin: 0, lineHeight: 1.6 }}>
            Este simulado é anterior aos marcadores: o prompt leva as {d.erradasSemTopico.length}{' '}
            questões que você errou.
          </p>
        )}
      </section>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="meta">Dificuldade</span>
        <div
          role="radiogroup"
          aria-label="Dificuldade"
          className="opcoes"
          style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
        >
          {(['descer', 'manter', 'subir'] as const).map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={o.ajuste === a}
              className="opcao"
              onClick={() => muda('ajuste', a)}
            >
              {NOMES_DO_AJUSTE[a]}
            </button>
          ))}
        </div>
        <span className="meta">{POR_QUE[ajusteSugerido(d.pct)]}</span>
      </div>

      {paraReforcar > 0 && (
        <label className="marcar-insistir">
          <input
            type="checkbox"
            checked={o.insistir}
            onChange={(e) => muda('insistir', e.target.checked)}
          />
          {nDuvidas > 0
            ? `Insistir no que errei ou marquei (${paraReforcar} ${paraReforcar === 1 ? 'questão' : 'questões'})`
            : `Insistir no que errei (${nErradas} ${nErradas === 1 ? 'questão' : 'questões'})`}
        </label>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="meta">Foco</span>
        <div
          role="radiogroup"
          aria-label="Foco"
          className="opcoes"
          style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
        >
          {(['equilibrado', 'edital', 'base'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={o.foco === f}
              className="opcao"
              style={{ fontSize: 13 }}
              onClick={() => muda('foco', f)}
            >
              {NOMES_DO_FOCO[f]}
            </button>
          ))}
        </div>
      </div>
      {o.foco === 'edital' && (
        <label className="campo">
          Conteúdo do edital (opcional)
          <textarea
            rows={4}
            value={o.edital}
            placeholder="Cole aqui o trecho do conteúdo programático"
            onChange={(e) => muda('edital', e.target.value)}
            style={{ padding: '10px 12px', resize: 'vertical' }}
          />
        </label>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <label className="campo">
          Quantidade
          <input
            type="number"
            min={1}
            max={100}
            value={o.quantidade}
            onChange={(e) =>
              muda('quantidade', Math.max(1, Math.min(100, Number(e.target.value) || 1)))
            }
          />
        </label>
        <label className="campo">
          Banca
          <input type="text" value={o.banca} onChange={(e) => muda('banca', e.target.value)} />
        </label>
      </div>
    </div>
  )
}

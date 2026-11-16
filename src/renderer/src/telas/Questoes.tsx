import { useMemo, useState, type DragEvent } from 'react'
import { Icone } from '../Icone'
import { Confirmar } from '../Confirmar'
import { novoId, type Mudar } from '../useDados'
import { acertos, formatarTempo, lerRespostaDaIa, montarPrompt } from '../../../shared/questoes'
import type {
  ConfigDoSimulado,
  Dados,
  IaDestino,
  Id,
  Nivel,
  Simulado,
  TipoDeQuestao
} from '../../../shared/tipos'

const CONFIG_INICIAL: ConfigDoSimulado = {
  tema: '',
  assuntoId: null,
  nivel: 'medio',
  tipo: 'multipla',
  quantidade: 10,
  tempoMin: 30,
  banca: ''
}

export function Questoes({
  dados,
  mudar,
  abrirSimulado
}: {
  dados: Dados
  mudar: Mudar
  abrirSimulado: (id: Id) => void
}) {
  const [config, setConfig] = useState<ConfigDoSimulado>(CONFIG_INICIAL)
  const [ia, setIa] = useState<IaDestino>('claude')
  const [copiado, setCopiado] = useState(false)
  const [resposta, setResposta] = useState('')
  const [arrastando, setArrastando] = useState(false)
  const [apagando, setApagando] = useState<Simulado | null>(null)

  const muda = <K extends keyof ConfigDoSimulado>(k: K, v: ConfigDoSimulado[K]): void => {
    setConfig((c) => ({ ...c, [k]: v }))
    setCopiado(false)
  }

  const prompt = montarPrompt(config, ia)
  const temaOk = config.tema.trim() !== '' && config.quantidade >= 1
  const leitura = useMemo(() => (resposta.trim() ? lerRespostaDaIa(resposta) : null), [resposta])

  const copiar = async (): Promise<void> => {
    await navigator.clipboard.writeText(prompt)
    setCopiado(true)
  }

  const lerArquivo = async (arquivo: File | undefined): Promise<void> => {
    if (arquivo) setResposta(await arquivo.text())
  }
  const soltar = (e: DragEvent): void => {
    e.preventDefault()
    setArrastando(false)
    void lerArquivo(e.dataTransfer.files[0])
  }

  const iniciar = (): void => {
    if (!leitura?.ok) return
    const id = novoId()
    const n = leitura.questoes.length
    const simulado: Simulado = {
      id,
      config: {
        ...config,
        tema: config.tema.trim() || leitura.tema || 'Simulado',
        tipo: leitura.tipo,
        quantidade: n
      },
      questoes: leitura.questoes,
      respostas: Array(n).fill(null),
      revisar: Array(n).fill(false),
      tempoPorQuestao: Array(n).fill(0),
      decorridoMs: 0,
      atual: 0,
      criadoEm: Date.now(),
      entregueEm: null
    }
    mudar((d) => {
      d.simulados.push(simulado)
    })
    setResposta('')
    setCopiado(false)
    abrirSimulado(id)
  }

  const historico = [...dados.simulados].sort((a, b) => b.criadoEm - a.criadoEm)

  return (
    <div className="tela">
      <main className="conteudo">
        <header className="cabecalho">
          <div>
            <div className="trilha">Questões / Novo simulado</div>
            <h1 className="titulo">Gerador de questões</h1>
          </div>
          <ol className="etapas" aria-label="Etapas">
            <li className={temaOk ? 'feita' : ''}>1 Configurar</li>
            <li className={copiado ? 'feita' : ''}>2 Copiar prompt</li>
            <li className={leitura?.ok ? 'feita' : ''}>3 Colar resposta</li>
          </ol>
        </header>

        <div className="colunas">
          <form
            className="form-gerador"
            aria-label="Configurar questões"
            onSubmit={(e) => e.preventDefault()}
          >
            <label className="campo">
              Tema
              <input
                type="text"
                placeholder="Ex.: Colocação pronominal"
                value={config.tema}
                onChange={(e) => muda('tema', e.target.value)}
                autoFocus
              />
            </label>
            <label className="campo">
              Ligar ao assunto (opcional)
              <select
                value={config.assuntoId ?? ''}
                onChange={(e) => {
                  const id = e.target.value || null
                  muda('assuntoId', id)
                  const a = dados.materias.flatMap((m) => m.assuntos).find((x) => x.id === id)
                  if (a && !config.tema.trim()) muda('tema', a.nome)
                }}
              >
                <option value="">Nenhum</option>
                {dados.materias.map((m) => (
                  <optgroup key={m.id} label={m.nome}>
                    {m.assuntos.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <Escolha<Nivel>
              rotulo="Nível"
              valor={config.nivel}
              opcoes={[
                ['facil', 'Fácil'],
                ['medio', 'Médio'],
                ['dificil', 'Difícil']
              ]}
              mudar={(v) => muda('nivel', v)}
            />
            <Escolha<TipoDeQuestao>
              rotulo="Formato"
              valor={config.tipo}
              opcoes={[
                ['multipla', 'Múltipla A–E'],
                ['certoErrado', 'Certo / Errado']
              ]}
              mudar={(v) => muda('tipo', v)}
            />

            <div
              style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}
            >
              <label className="campo">
                Quantidade
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={config.quantidade}
                  onChange={(e) =>
                    muda('quantidade', Math.max(1, Math.min(100, Number(e.target.value) || 1)))
                  }
                />
              </label>
              <label className="campo">
                Tempo (min)
                <input
                  type="number"
                  min={0}
                  max={600}
                  value={config.tempoMin}
                  onChange={(e) =>
                    muda('tempoMin', Math.max(0, Math.min(600, Number(e.target.value) || 0)))
                  }
                  title="0 = sem limite (o cronômetro só conta)"
                />
              </label>
            </div>
            <label className="campo">
              Banca (opcional)
              <input
                type="text"
                placeholder="Ex.: FGV, Cebraspe, FCC"
                value={config.banca}
                onChange={(e) => muda('banca', e.target.value)}
              />
            </label>
          </form>

          <section className="painel-prompt" aria-labelledby="titulo-prompt">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <h2 id="titulo-prompt" className="secao">
                Prompt pronto
              </h2>
              <div
                role="radiogroup"
                aria-label="IA de destino"
                className="opcoes"
                style={{ marginLeft: 'auto', gridTemplateColumns: 'repeat(2, auto)' }}
              >
                {(['claude', 'gpt'] as const).map((x) => (
                  <button
                    key={x}
                    type="button"
                    role="radio"
                    aria-checked={ia === x}
                    className="opcao"
                    style={{ minHeight: 36, padding: '0 14px' }}
                    onClick={() => {
                      setIa(x)
                      setCopiado(false)
                    }}
                  >
                    {x === 'claude' ? 'Claude' : 'GPT'}
                  </button>
                ))}
              </div>
            </div>
            <pre className="prompt" style={{ opacity: temaOk ? 1 : 0.4 }}>
              {prompt}
            </pre>
            <button
              type="button"
              className="botao principal"
              style={{ alignSelf: 'flex-start' }}
              disabled={!temaOk}
              onClick={() => void copiar()}
            >
              <Icone nome={copiado ? 'check' : 'copiar'} tamanho={16} />
              {copiado ? 'Copiado — cole na IA' : 'Copiar prompt'}
            </button>

            <h2 className="secao" style={{ marginTop: 14 }}>
              Colar resposta da IA
            </h2>
            <textarea
              className={`colar ${arrastando ? 'arrastando' : ''}`}
              aria-label="Resposta da IA"
              placeholder="Cole aqui a resposta inteira (Ctrl+V) ou solte o arquivo .json"
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              onDragOver={(e) => {
                e.preventDefault()
                setArrastando(true)
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={soltar}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <label className="botao" style={{ cursor: 'pointer' }}>
                <Icone nome="enviar" tamanho={16} />
                Abrir arquivo
                <input
                  type="file"
                  accept=".json,.txt,application/json,text/plain"
                  style={{ display: 'none' }}
                  onChange={(e) => void lerArquivo(e.target.files?.[0])}
                />
              </label>
              {resposta && (
                <button type="button" className="botao" onClick={() => setResposta('')}>
                  Limpar
                </button>
              )}
            </div>

            {leitura && !leitura.ok && (
              <div className="aviso erro" role="alert">
                {leitura.erro}
              </div>
            )}
            {leitura?.ok && (
              <div
                className="aviso ok"
                style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}
              >
                <span>
                  ✓ {leitura.questoes.length} QUESTÕES VÁLIDAS · GABARITO E RESOLUÇÃO EM TODAS
                  {leitura.questoes.length !== config.quantidade &&
                    ` · VOCÊ PEDIU ${config.quantidade}`}
                </span>
                <button
                  type="button"
                  className="botao sucesso"
                  style={{ marginLeft: 'auto' }}
                  onClick={iniciar}
                >
                  Iniciar simulado · {config.tempoMin ? `${config.tempoMin} min` : 'sem limite'}
                </button>
              </div>
            )}
          </section>
        </div>

        {historico.length > 0 && (
          <section
            aria-labelledby="titulo-historico"
            style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}
          >
            <h2 id="titulo-historico" className="secao">
              Meus simulados
            </h2>
            <div className="historico">
              {historico.map((s) => {
                const total = s.questoes.length
                const certas = acertos(s.questoes, s.respostas)
                const pct = Math.round((certas / total) * 100)
                return (
                  <div key={s.id} className="linha-historico">
                    <span className="nome">{s.config.tema}</span>
                    <span className="meta">{new Date(s.criadoEm).toLocaleDateString('pt-BR')}</span>
                    <span className="meta">
                      {total} questões · {formatarTempo(s.decorridoMs)}
                    </span>
                    {s.entregueEm ? (
                      <span
                        style={{ fontFamily: 'var(--mono)' }}
                        className={pct >= 70 ? 'nota-boa' : pct >= 50 ? 'nota-media' : 'nota-ruim'}
                      >
                        {certas}/{total} · {pct}%
                      </span>
                    ) : (
                      <span className="meta" style={{ color: 'var(--ambar)' }}>
                        Em andamento
                      </span>
                    )}
                    <button type="button" className="botao" onClick={() => abrirSimulado(s.id)}>
                      {s.entregueEm ? 'Ver gabarito' : 'Continuar'}
                    </button>
                    <button
                      type="button"
                      className="botao-icone"
                      aria-label={`Apagar simulado ${s.config.tema}`}
                      title="Apagar"
                      onClick={() => setApagando(s)}
                    >
                      <Icone nome="lixo" tamanho={15} />
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>

      {apagando && (
        <Confirmar
          titulo="Apagar este simulado?"
          texto={`“${apagando.config.tema}” e as respostas dele somem do histórico.`}
          botao="Apagar"
          aoConfirmar={() => {
            const id = apagando.id
            setApagando(null)
            mudar((d) => {
              d.simulados = d.simulados.filter((s) => s.id !== id)
            })
          }}
          aoCancelar={() => setApagando(null)}
        />
      )}
    </div>
  )
}

function Escolha<T extends string>({
  rotulo,
  valor,
  opcoes,
  mudar
}: {
  rotulo: string
  valor: T
  opcoes: [T, string][]
  mudar: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="meta">{rotulo}</span>
      <div
        role="radiogroup"
        aria-label={rotulo}
        className="opcoes"
        style={{ gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))` }}
      >
        {opcoes.map(([v, nome]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={valor === v}
            className="opcao"
            onClick={() => mudar(v)}
          >
            {nome}
          </button>
        ))}
      </div>
    </div>
  )
}

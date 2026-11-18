import { useEffect, useRef, useState } from 'react'
import { Icone } from '../Icone'
import { novoId, type Mudar } from '../useDados'
import type { AlvoDaRevisao } from '../App'
import { nosDaMateria } from '../../../shared/arvore'
import { importarEstrutura } from '../../../shared/estrutura'
import {
  acharMateria,
  dataDoEdital,
  diasAte,
  itensDoEdital,
  estudadoPonderado,
  lerEditalColado,
  proximoPasso,
  situacaoDoEdital,
  type MateriaLida,
  type SituacaoDaMateria
} from '../../../shared/edital'
import type { Dados, Id } from '../../../shared/tipos'

const pct = (x: number): string => `${Math.round(x * 100)}%`

/** O concurso numa tela: quanto falta, quanto cada matéria vale e o próximo
 *  passo de cada uma, da que mais precisa de estudo para a que menos. */
export function MeuEdital({
  dados,
  mudar,
  agora,
  estudar,
  gerarSimulado,
  adaptar,
  abrirCaixa
}: {
  dados: Dados
  mudar: Mudar
  agora: Date
  estudar: (alvo: AlvoDaRevisao) => void
  gerarSimulado: (materiaId: Id) => void
  adaptar: (simuladoId: Id) => void
  abrirCaixa: () => void
}) {
  const [colando, setColando] = useState(false)
  const e = dados.edital
  const situacao = situacaoDoEdital(dados, agora)
  const dias = e ? diasAte(e.dataProva, agora) : null

  const fazer = (s: SituacaoDaMateria): void => {
    const p = proximoPasso(s)
    if (p.tipo === 'revisar') {
      const m = dados.materias.find((x) => x.id === s.materiaId)!
      estudar({ assuntos: nosDaMateria(dados, m).map((n) => n.id), titulo: m.nome })
    } else if (p.tipo === 'adaptar') adaptar(p.simuladoId)
    else gerarSimulado(s.materiaId)
  }

  return (
    <div className="tela">
      <main className="conteudo">
        {!e ? (
          <div className="vazio">
            <Icone nome="alvo" tamanho={40} />
            <p>Cole o conteúdo programático do seu edital, ou importe um edital pronto da caixa.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="botao principal" onClick={() => setColando(true)}>
                Colar edital
              </button>
              <button type="button" className="botao" onClick={abrirCaixa}>
                Do Claude
              </button>
            </div>
          </div>
        ) : (
          <>
            <header className="cabecalho">
              <div>
                <div className="trilha">Meu edital{e.banca && ` · ${e.banca}`}</div>
                <h1 className="titulo">{e.nome}</h1>
              </div>
              <div className="placar" style={{ marginLeft: 'auto' }}>
                {dias !== null && (
                  <div>
                    <span className="meta">Prova</span>
                    <span className="numero">
                      {dias > 0 ? `${dias} dias` : dias === 0 ? 'hoje' : 'já foi'}
                    </span>
                    <span className="meta">{e.dataProva.split('-').reverse().join('/')}</span>
                  </div>
                )}
                <div>
                  <span className="meta">Estudado</span>
                  <span className="numero nota-media">{pct(estudadoPonderado(situacao))}</span>
                  <span className="meta">pelo peso de cada matéria</span>
                </div>
                {e.notaMinima !== undefined && (
                  <div>
                    <span className="meta">Nota mínima</span>
                    <span className="numero">{e.notaMinima.toLocaleString('pt-BR')}</span>
                  </div>
                )}
              </div>
              <button type="button" className="botao" onClick={() => setColando(true)}>
                Trocar edital
              </button>
            </header>

            <section aria-labelledby="t-prioridade" className="lista-edital">
              <h2 id="t-prioridade" className="secao">
                Onde estudar primeiro
              </h2>
              <div className="linha-edital cabeca" aria-hidden="true">
                <span>Matéria</span>
                <span>Questões</span>
                <span>Peso na nota</span>
                <span>Estudado</span>
                <span>Acerto</span>
                <span />
              </div>
              {situacao.map((s) => {
                const passo = proximoPasso(s)
                return (
                  <div key={s.materiaId} className="linha-edital">
                    <span className="nome">{s.nome}</span>
                    <span className="numero-pequeno">{s.questoes}</span>
                    <span className="medidor">
                      <span className="valor ciano">{pct(s.peso)}</span>
                      <span className="barra">
                        <span style={{ width: `${Math.min(100, s.peso * 400)}%` }} />
                      </span>
                    </span>
                    <span className="medidor">
                      <span className="valor">{pct(s.estudado)}</span>
                      <span className="barra verde">
                        <span style={{ width: `${s.estudado * 100}%` }} />
                      </span>
                    </span>
                    <span
                      className={`numero-pequeno ${s.acerto === null ? 'sem' : s.acerto >= 0.7 ? 'nota-boa' : 'nota-media'}`}
                    >
                      {s.acerto === null ? 'sem simulado' : pct(s.acerto)}
                    </span>
                    <button
                      type="button"
                      className={`botao passo ${passo.tipo === 'simulado' && !s.ultimoSimulado ? 'pendente' : ''}`}
                      onClick={() => fazer(s)}
                    >
                      {passo.texto}
                      <Icone nome="direita" tamanho={14} />
                    </button>
                  </div>
                )
              })}
            </section>
          </>
        )}
      </main>
      {colando && <ColarEdital dados={dados} mudar={mudar} fechar={() => setColando(false)} />}
    </div>
  )
}

type Linha = MateriaLida & { usar: boolean; questoes: string; peso: string }

// ponytail: o <dialog> do navegador já prende o foco, fecha no Esc e escurece o fundo
function ColarEdital({ dados, mudar, fechar }: { dados: Dados; mudar: Mudar; fechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  const [nome, setNome] = useState(dados.edital?.nome ?? '')
  const [banca, setBanca] = useState(dados.edital?.banca ?? '')
  const [data, setData] = useState(dados.edital?.dataProva.split('-').reverse().join('/') ?? '')
  const [texto, setTexto] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [erro, setErro] = useState('')

  const ler = (t: string): void => {
    setTexto(t)
    setLinhas(lerEditalColado(t).map((m) => ({ ...m, usar: true, questoes: '', peso: '1' })))
  }
  const muda = (i: number, campo: Partial<Linha>): void =>
    setLinhas((ls) => ls.map((l, k) => (k === i ? { ...l, ...campo } : l)))

  const criar = (): void => {
    const usadas = linhas.filter((l) => l.usar)
    if (!nome.trim()) return setErro('Dê um nome ao concurso.')
    if (!usadas.length) return setErro('Nenhuma matéria marcada.')
    if (usadas.some((l) => !(Number(l.questoes) > 0)))
      return setErro('Preencha quantas questões cada matéria tem na prova.')
    const quando = data.trim() ? dataDoEdital(data) : ''
    if (data.trim() && !quando) return setErro('Data da prova no formato dd/mm/aaaa.')
    mudar((d) => {
      const materias = usadas.map((l) => {
        let id = acharMateria(d, l.nome)
        if (!id) {
          id = novoId()
          d.materias.push({ id, nome: l.nome, aberta: true, assuntos: [] })
        }
        // cada item do edital vira um assunto (o que já existe com o mesmo nome fica)
        importarEstrutura(
          d,
          [{ nome: l.nome, filhos: itensDoEdital(l.texto).map((nome) => ({ nome, filhos: [] })) }],
          novoId,
          Date.now(),
          id
        )
        return {
          materiaId: id,
          questoes: Number(l.questoes),
          peso: Number(l.peso) > 0 ? Number(l.peso) : 1,
          texto: l.texto
        }
      })
      d.edital = { nome: nome.trim(), banca: banca.trim(), dataProva: quando, materias }
    })
    fechar()
  }

  return (
    <dialog
      ref={ref}
      onClose={fechar}
      aria-labelledby="t-colar-edital"
      className="config colar-edital"
    >
      <header>
        <h2 id="t-colar-edital">Colar edital</h2>
        <button type="button" className="botao-icone" aria-label="Fechar" onClick={fechar}>
          <Icone nome="fechar" />
        </button>
      </header>
      <section>
        <div className="campos-edital">
          <label className="campo">
            Concurso
            <input value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label className="campo">
            Banca
            <input value={banca} onChange={(e) => setBanca(e.target.value)} />
          </label>
          <label className="campo">
            Prova
            <input
              placeholder="dd/mm/aaaa"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </label>
        </div>
        <label className="campo">
          Conteúdo programático
          <textarea
            rows={5}
            placeholder="LÍNGUA PORTUGUESA: Ortografia e acentuação. Crase…"
            value={texto}
            onChange={(e) => ler(e.target.value)}
          />
        </label>
        {texto.trim() && (
          <span className="meta">
            {linhas.length
              ? `Encontrei ${linhas.length} matérias · ${linhas.reduce((n, l) => n + l.itens, 0)} itens`
              : 'Não achei matérias. Cada uma começa numa linha com o nome em maiúsculas e dois-pontos.'}
          </span>
        )}
        {linhas.length > 0 && (
          <div className="materias-lidas">
            <div className="linha-lida cabeca" aria-hidden="true">
              <span />
              <span>Matéria</span>
              <span>Questões</span>
              <span>Peso da prova</span>
            </div>
            {linhas.map((l, i) => (
              <div key={i} className="linha-lida">
                <input
                  type="checkbox"
                  aria-label={`Usar ${l.nome}`}
                  checked={l.usar}
                  onChange={(e) => muda(i, { usar: e.target.checked })}
                />
                <input
                  aria-label="Nome da matéria"
                  value={l.nome}
                  onChange={(e) => muda(i, { nome: e.target.value })}
                />
                <input
                  aria-label={`Questões de ${l.nome}`}
                  inputMode="numeric"
                  value={l.questoes}
                  onChange={(e) => muda(i, { questoes: e.target.value.replace(/\D/g, '') })}
                />
                <input
                  aria-label={`Peso da prova de ${l.nome}`}
                  inputMode="numeric"
                  value={l.peso}
                  onChange={(e) =>
                    muda(i, { peso: e.target.value.replace(/[^\d,.]/g, '').replace(',', '.') })
                  }
                />
              </div>
            ))}
          </div>
        )}
        {erro && (
          <div className="aviso erro" role="alert">
            {erro}
          </div>
        )}
        <div className="acoes-dialogo">
          <button type="button" className="botao" onClick={fechar}>
            Cancelar
          </button>
          <button
            type="button"
            className="botao principal"
            disabled={!linhas.length}
            onClick={criar}
          >
            Criar matérias e assuntos
          </button>
        </div>
      </section>
    </dialog>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Icone } from './Icone'
import { useAtualizacao } from './Atualizacao'
import { SecaoSincronizar, useNuvem } from './Sincronizar'
import type { Mudar } from './useDados'
import type { Dados } from '../../shared/tipos'

const hora = (ms: number): string =>
  new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const dataEHora = (ms: number): string => {
  const d = new Date(ms)
  const hoje = new Date().toDateString() === d.toDateString()
  return hoje
    ? `hoje, ${hora(ms)}`
    : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

// ponytail: o <dialog> do navegador já prende o foco, fecha no Esc e escurece o fundo
export function Configuracoes({
  dados,
  mudar,
  fechar
}: {
  dados: Dados
  mudar: Mudar
  fechar: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  const { versao, estado } = useAtualizacao()
  const nuvem = useNuvem()
  const [backup, setBackup] = useState<'parado' | 'salvando' | 'erro'>('parado')

  const fazerBackup = async (): Promise<void> => {
    setBackup('salvando')
    try {
      const quando = await window.api.fazerBackup(dados)
      mudar((d) => {
        d.ultimoBackup = quando
      })
      setBackup('parado')
    } catch {
      setBackup('erro')
    }
  }

  const ocupado = estado.estado === 'procurando' || estado.estado === 'baixando'

  return (
    <dialog ref={ref} onClose={fechar} aria-labelledby="titulo-config" className="config">
      <header>
        <span style={{ color: 'var(--ciano)', display: 'flex' }}>
          <Icone nome="engrenagem" tamanho={20} />
        </span>
        <h2 id="titulo-config">Configurações</h2>
        <button type="button" className="botao-icone" aria-label="Fechar" onClick={fechar}>
          <Icone nome="fechar" />
        </button>
      </header>

      <section aria-labelledby="titulo-atualizacao">
        <h3 id="titulo-atualizacao" className="secao">
          Atualização
        </h3>
        <div className="linha-config">
          <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="versao">v{versao}</span>
            <EstadoDaAtualizacao estado={estado} />
          </div>
          {estado.estado === 'pronta' ? (
            <button
              type="button"
              className="botao sucesso"
              onClick={() => void window.api.reiniciarParaAtualizar()}
            >
              Reiniciar agora
            </button>
          ) : (
            <button
              type="button"
              className="botao principal"
              disabled={ocupado}
              onClick={() => void window.api.procurarAtualizacao()}
            >
              <Icone nome="atualizar" tamanho={16} />
              {estado.estado === 'procurando' ? 'Procurando…' : 'Procurar agora'}
            </button>
          )}
        </div>
        {estado.estado === 'baixando' && (
          <div className="progresso" aria-hidden="true">
            <div style={{ width: `${estado.porcento}%` }} />
          </div>
        )}
      </section>

      <SecaoSincronizar />

      <section aria-labelledby="titulo-dados">
        <h3 id="titulo-dados" className="secao">
          Meus dados
        </h3>
        <p>
          {nuvem.situacao === 'desconectado' ? 'Tudo fica neste PC.' : 'Neste PC e na nuvem.'}{' '}
          {dados.ultimoBackup
            ? `Último backup: ${dataEHora(dados.ultimoBackup)}.`
            : 'Nenhum backup feito ainda.'}
        </p>
        {backup === 'erro' && (
          <div className="aviso erro" role="alert">
            Não consegui fazer o backup. Veja se o disco tem espaço.
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            className="botao"
            disabled={backup === 'salvando'}
            onClick={() => void fazerBackup()}
          >
            {backup === 'salvando' ? 'Salvando…' : 'Fazer backup agora'}
          </button>
          <button
            type="button"
            className="botao"
            onClick={() => void window.api.abrirPastaDosDados()}
          >
            <Icone nome="pasta" tamanho={16} />
            Abrir pasta dos dados
          </button>
        </div>
      </section>
    </dialog>
  )
}

function EstadoDaAtualizacao({ estado }: { estado: ReturnType<typeof useAtualizacao>['estado'] }) {
  switch (estado.estado) {
    case 'emDia':
      return (
        <span className="meta" style={{ color: 'var(--verde)' }}>
          ✓ Versão mais recente · verificado às {hora(estado.verificadoEm)}
        </span>
      )
    case 'procurando':
      return <span className="meta">Procurando versão nova…</span>
    case 'baixando':
      return (
        <span className="meta" style={{ color: 'var(--ciano)' }}>
          Baixando v{estado.versao} · {estado.porcento}%
        </span>
      )
    case 'pronta':
      return (
        <span className="meta" style={{ color: 'var(--verde)' }}>
          v{estado.versao} pronta para instalar
        </span>
      )
    case 'erro':
      return (
        <span className="meta" role="alert" style={{ color: 'var(--vermelho)' }}>
          {estado.mensagem}
        </span>
      )
    default:
      return <span className="meta">Procura sozinha ao abrir e a cada 4 h</span>
  }
}

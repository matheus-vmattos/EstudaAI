import { useEffect, useState } from 'react'
import type { EstadoDaAtualizacao } from '../../shared/tipos'

/** versão do app e estado da atualização, vindos do processo principal */
export function useAtualizacao(): { versao: string; estado: EstadoDaAtualizacao } {
  const [versao, setVersao] = useState('')
  const [estado, setEstado] = useState<EstadoDaAtualizacao>({ estado: 'parado' })
  useEffect(() => {
    void window.api.versao().then(setVersao)
    void window.api.estadoDaAtualizacao().then(setEstado)
    return window.api.aoMudarAtualizacao(setEstado)
  }, [])
  return { versao, estado }
}

/** Rodapé do menu: a versão e, quando houver, a atualização baixada. O
 *  simulado e a revisão escondem o menu, então nunca interrompem o estudo. */
export function Atualizacao() {
  const { versao, estado } = useAtualizacao()
  if (estado.estado === 'pronta') {
    return (
      <button
        type="button"
        className="botao sucesso"
        style={{ width: '100%', minHeight: 44, marginTop: 8, fontSize: 12, whiteSpace: 'normal' }}
        onClick={() => void window.api.reiniciarParaAtualizar()}
      >
        v{estado.versao} pronta · Reiniciar
      </button>
    )
  }
  return (
    <div>
      v{versao}
      {estado.estado === 'baixando' && ` · baixando ${estado.porcento}%`}
    </div>
  )
}

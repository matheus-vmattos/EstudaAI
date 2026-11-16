import { useEffect, useState } from 'react'
import type { EstadoDaAtualizacao } from '../../shared/tipos'

/** Versão do app e, quando houver, a atualização baixada. Fica no rodapé do
 *  menu: o simulado esconde o menu, então nunca interrompe uma prova. */
export function Atualizacao() {
  const [versao, setVersao] = useState('')
  const [estado, setEstado] = useState<EstadoDaAtualizacao>({ estado: 'parado' })

  useEffect(() => {
    void window.api.versao().then(setVersao)
    void window.api.estadoDaAtualizacao().then(setEstado)
    return window.api.aoMudarAtualizacao(setEstado)
  }, [])

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
      {estado.estado === 'baixando' && ` · baixando v${estado.versao} ${estado.porcento}%`}
    </div>
  )
}

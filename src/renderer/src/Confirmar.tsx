import { useEffect, useRef } from 'react'

// ponytail: o <dialog> do navegador já prende o foco, fecha no Esc e escurece o fundo
export function Confirmar({
  titulo,
  texto,
  botao,
  aoConfirmar,
  aoCancelar
}: {
  titulo: string
  texto: string
  botao: string
  aoConfirmar: () => void
  aoCancelar: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog ref={ref} onClose={aoCancelar} aria-labelledby="confirmar-titulo">
      <h2 id="confirmar-titulo">{titulo}</h2>
      <p>{texto}</p>
      <div className="acoes-dialogo">
        <button type="button" className="botao" onClick={aoCancelar}>
          Cancelar
        </button>
        <button type="button" className="botao principal" onClick={aoConfirmar} autoFocus>
          {botao}
        </button>
      </div>
    </dialog>
  )
}

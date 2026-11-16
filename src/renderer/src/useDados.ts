import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dados } from '../../shared/tipos'

export type Mudar = (receita: (rascunho: Dados) => void) => void

/** Estado único do app. Toda mudança passa por `mudar` e é salva no PC
 *  meio segundo depois (e na hora em que a janela fecha). */
export function useDados(): { dados: Dados | null; mudar: Mudar; erroAoSalvar: boolean } {
  const [dados, setDados] = useState<Dados | null>(null)
  const [erroAoSalvar, setErro] = useState(false)
  const pendente = useRef<Dados | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    void window.api.lerDados().then(setDados)
  }, [])

  const gravar = useCallback(() => {
    window.clearTimeout(timer.current)
    const d = pendente.current
    if (!d) return
    pendente.current = null
    window.api.salvarDados(d).then(
      () => setErro(false),
      () => setErro(true)
    )
  }, [])

  // ao fechar (ou reiniciar para atualizar) grava síncrono: um envio
  // assíncrono podia se perder no meio do fechamento
  useEffect(() => {
    const gravarAgora = (): void => {
      window.clearTimeout(timer.current)
      const d = pendente.current
      if (!d) return
      pendente.current = null
      window.api.salvarAgora(d)
    }
    window.addEventListener('beforeunload', gravarAgora)
    return () => window.removeEventListener('beforeunload', gravarAgora)
  }, [])

  const mudar = useCallback<Mudar>(
    (receita) => {
      setDados((atual) => {
        if (!atual) return atual
        // ponytail: copiar tudo a cada mudança é barato no tamanho de um
        // uso individual e evita mutar o estado do React por engano
        const novo = structuredClone(atual)
        receita(novo)
        pendente.current = novo
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(gravar, 500)
        return novo
      })
    },
    [gravar]
  )

  return { dados, mudar, erroAoSalvar }
}

export const novoId = (): string => crypto.randomUUID()

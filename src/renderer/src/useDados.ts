import { useCallback, useEffect, useRef, useState } from 'react'
import { registrarDiaDeEstudo } from '../../shared/estudoDoDia'
import type { Dados } from '../../shared/tipos'

export type Mudar = (receita: (rascunho: Dados) => void) => void

/** Estado único do app. Toda mudança passa por `mudar` e é salva no PC
 *  meio segundo depois (e na hora em que a janela fecha). */
export function useDados(): { dados: Dados | null; mudar: Mudar; erroAoSalvar: boolean } {
  const [dados, setDados] = useState<Dados | null>(null)
  const [erroAoSalvar, setErro] = useState(false)
  const pendente = useRef<Dados | null>(null)
  // gravações a caminho do PC: a nuvem não pode trocar os dados no meio
  const salvando = useRef(0)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    void window.api.lerDados().then((d) => {
      setDados(d)
      // só depois de a tela ter os dados: se a nuvem tiver coisa mais nova, ela pede a troca
      void window.api.nuvemSincronizar()
    })
  }, [])

  const gravar = useCallback(function gravar() {
    window.clearTimeout(timer.current)
    const d = pendente.current
    if (!d) return
    pendente.current = null
    salvando.current++
    window.api.salvarDados(d).then(
      () => {
        salvando.current--
        setErro(false)
      },
      () => {
        salvando.current--
        setErro(true)
        // devolve para a fila (sem passar por cima de mudança mais nova) e
        // tenta de novo: na próxima edição, em 5 s ou ao fechar
        pendente.current ??= d
        timer.current = window.setTimeout(gravar, 5000)
      }
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

  // a nuvem tem dados mais novos (do outro PC): troca, a menos que haja
  // mudança daqui ainda não salva -- aí salva e a nuvem pergunta qual fica
  useEffect(
    () =>
      window.api.aoPerguntarNuvem<{ dados: Dados }>('nuvem:trocar', ({ id, dados: novos }) => {
        if (pendente.current || salvando.current) {
          gravar()
          window.api.responderNuvem(id, 'recusou')
          return
        }
        // síncrono: o processo principal só troca o arquivo se nada mudou
        // aqui desde a decisão; na mesma tarefa a tela troca o estado
        const trocou = window.api.aplicarTrocaDaNuvem()
        if (trocou) setDados(novos)
        window.api.responderNuvem(id, trocou ? 'aceitou' : 'recusou')
      }),
    [gravar]
  )

  const mudar = useCallback<Mudar>(
    (receita) => {
      setDados((atual) => {
        if (!atual) return atual
        // ponytail: copiar tudo a cada mudança é barato no tamanho de um
        // uso individual e evita mutar o estado do React por engano
        const novo = structuredClone(atual)
        receita(novo)
        registrarDiaDeEstudo(novo)
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

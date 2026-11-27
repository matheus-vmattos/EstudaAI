import { textoComFormulas, textoDaQuestao } from './markdown'

/** texto vindo da IA com as fórmulas desenhadas ($M = C(1+i)^n$); `comando`
 *  destaca NÃO/EXCETO/APENAS e devolve o <u>sublinhado</u> (enunciado) */
export function Texto({ texto, comando }: { texto: string; comando?: boolean }) {
  return (
    <span
      dangerouslySetInnerHTML={{
        __html: comando ? textoDaQuestao(texto) : textoComFormulas(texto)
      }}
    />
  )
}

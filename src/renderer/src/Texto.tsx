import { textoComFormulas } from './markdown'

/** texto vindo da IA com as fórmulas desenhadas ($M = C(1+i)^n$) */
export function Texto({ texto }: { texto: string }) {
  return <span dangerouslySetInnerHTML={{ __html: textoComFormulas(texto) }} />
}

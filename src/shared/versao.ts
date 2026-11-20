/** A versão do app atende à mínima pedida? ("0.1.19" >= "0.1.9"). Sem
 *  mínima, atende. Serve para a caixa não oferecer a um app antigo um item
 *  que ele ainda não sabe abrir. */
export function versaoAtende(atual: string, minima?: string): boolean {
  if (!minima) return true
  const a = atual.split('.').map(Number)
  const m = minima.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, m.length); i++) {
    const x = a[i] ?? 0
    const y = m[i] ?? 0
    if (x !== y) return x > y
  }
  return true
}

/** "Crase É" → "crase e": para buscar sem se importar com acento e maiúscula */
export const semAcento = (s: string): string =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** "youtube.com/x" → "https://youtube.com/x"; devolve null se não for link web */
export function normalizarUrl(bruto: string): string | null {
  const t = bruto.trim()
  if (!t) return null
  const comProtocolo = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`
  try {
    const u = new URL(comProtocolo)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (!u.hostname.includes('.')) return null
    return u.toString()
  } catch {
    return null
  }
}

export type TipoDeLink = 'video' | 'pdf' | 'site'

export function tipoDoLink(url: string): TipoDeLink {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (/(^|\.)youtube\.com$|^youtu\.be$|(^|\.)vimeo\.com$/.test(host)) return 'video'
    if (u.pathname.toLowerCase().endsWith('.pdf')) return 'pdf'
  } catch {
    /* link inválido conta como site */
  }
  return 'site'
}

/** "há 2 dias", "agora há pouco" */
export function haQuantoTempo(quando: number, agora = Date.now()): string {
  const min = Math.floor((agora - quando) / 60000)
  if (min < 1) return 'agora há pouco'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'ontem' : `há ${d} dias`
}

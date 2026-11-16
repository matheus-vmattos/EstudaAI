import { describe, expect, it } from 'vitest'
import { haQuantoTempo, normalizarUrl, semAcento, tipoDoLink } from '../src/shared/texto'

describe('texto', () => {
  it('busca sem acento', () => {
    expect(semAcento('Concordância VERBAL')).toBe('concordancia verbal')
  })
  it('normaliza links e recusa o que não é web', () => {
    expect(normalizarUrl('youtube.com/watch?v=1')).toBe('https://youtube.com/watch?v=1')
    expect(normalizarUrl('javascript:alert(1)')).toBeNull()
    expect(normalizarUrl('file:///C:/x.pdf')).toBeNull()
    expect(normalizarUrl('pronomes')).toBeNull()
  })
  it('reconhece o tipo do link', () => {
    expect(tipoDoLink('https://www.youtube.com/watch?v=1')).toBe('video')
    expect(tipoDoLink('https://youtu.be/abc')).toBe('video')
    expect(tipoDoLink('https://site.gov.br/lei.PDF')).toBe('pdf')
    expect(tipoDoLink('https://planalto.gov.br')).toBe('site')
  })
  it('diz há quanto tempo', () => {
    const agora = Date.now()
    expect(haQuantoTempo(agora - 2 * 86400000, agora)).toBe('há 2 dias')
    expect(haQuantoTempo(agora - 5 * 60000, agora)).toBe('há 5 min')
  })
})

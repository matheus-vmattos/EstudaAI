import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Duas regras de topo com o mesmo nome de classe: a segunda muda a primeira
// em OUTRA tela sem ninguém ver. Foi o defeito da 0.1.24: o CSS do bloco de
// notas (.bloco, .cabeca-bloco, .titulo-bloco) e do Raio-X (.linha-erro)
// reaproveitou nomes que já existiam e quebrou o cronômetro da prova, a Prova
// completa e o painel do simulado adaptado.
describe('CSS: cada classe de topo é definida uma vez', () => {
  it('não há duas regras ".classe {" no nível de cima', () => {
    const css = readFileSync(join(__dirname, '../src/renderer/src/estilo.css'), 'utf8')
    const regras = [...css.matchAll(/^\.([\w-]+) \{/gm)].map((m) => m[1])
    const vistas = new Set<string>()
    const repetidas = new Set<string>()
    for (const r of regras) (vistas.has(r) ? repetidas : vistas).add(r)
    // .area-mapa: já era assim antes (a segunda só repete o cursor)
    repetidas.delete('area-mapa')
    expect([...repetidas]).toEqual([])
  })
  it('a classe .bloco é do cronômetro da prova; nada de topo a redefine', () => {
    const css = readFileSync(join(__dirname, '../src/renderer/src/estilo.css'), 'utf8')
    expect(css).not.toMatch(/^\.bloco \{/m)
  })
})

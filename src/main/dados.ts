import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import { DADOS_VAZIOS, type Dados } from '../shared/tipos'

/** Tudo fica num arquivo só, no PC: %APPDATA%/EstudaAI/estudaai.json.
 *  ponytail: um JSON basta para um uso individual (milhares de anotações e
 *  questões cabem em poucos MB). Limite: se passar de ~50 MB, trocar por
 *  SQLite (better-sqlite3). */
const pasta = (): string => app.getPath('userData')
const arquivo = (): string => join(pasta(), 'estudaai.json')

export function lerDados(): Dados {
  const caminho = arquivo()
  if (!existsSync(caminho)) return structuredClone(DADOS_VAZIOS)
  try {
    const dados = JSON.parse(readFileSync(caminho, 'utf-8')) as Dados
    // cópia do último arquivo que abriu bem: se um dia o principal
    // corromper, o .bak tem tudo até a abertura anterior
    copyFileSync(caminho, `${caminho}.bak`)
    return { ...structuredClone(DADOS_VAZIOS), ...dados }
  } catch {
    // nunca sobrescreve um arquivo que não conseguiu ler: guarda à parte
    renameSync(caminho, `${caminho}.ilegivel-${Date.now()}`)
    return structuredClone(DADOS_VAZIOS)
  }
}

/** grava num temporário e troca o nome: desligar no meio nunca deixa o
 *  arquivo pela metade */
export function salvarDados(dados: Dados): void {
  mkdirSync(pasta(), { recursive: true })
  const caminho = arquivo()
  writeFileSync(`${caminho}.tmp`, JSON.stringify(dados), 'utf-8')
  renameSync(`${caminho}.tmp`, caminho)
}

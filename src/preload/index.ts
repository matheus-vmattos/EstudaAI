import { contextBridge, ipcRenderer } from 'electron'
import type { Dados, EstadoDaAtualizacao } from '../shared/tipos'

const api = {
  lerDados: (): Promise<Dados> => ipcRenderer.invoke('dados:ler'),
  salvarDados: (dados: Dados): Promise<void> => ipcRenderer.invoke('dados:salvar', dados),
  /** síncrono: só para o fechamento da janela */
  salvarAgora: (dados: Dados): boolean => ipcRenderer.sendSync('dados:salvarAgora', dados),
  lerAreaDeTransferencia: (): Promise<string> => ipcRenderer.invoke('clipboard:ler'),
  copiar: (texto: string): Promise<void> => ipcRenderer.invoke('clipboard:escrever', texto),
  abrirLink: (url: string): Promise<boolean> => ipcRenderer.invoke('link:abrir', url),
  versao: (): Promise<string> => ipcRenderer.invoke('app:versao'),
  estadoDaAtualizacao: (): Promise<EstadoDaAtualizacao> => ipcRenderer.invoke('atualizacao:estado'),
  aoMudarAtualizacao: (fn: (e: EstadoDaAtualizacao) => void): (() => void) => {
    const ouvir = (_: unknown, e: EstadoDaAtualizacao): void => fn(e)
    ipcRenderer.on('atualizacao:estado', ouvir)
    return () => ipcRenderer.removeListener('atualizacao:estado', ouvir)
  },
  reiniciarParaAtualizar: (): Promise<void> => ipcRenderer.invoke('atualizacao:reiniciar')
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)

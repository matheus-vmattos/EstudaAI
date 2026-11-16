import { contextBridge, ipcRenderer } from 'electron'
import type { Dados } from '../shared/tipos'

const api = {
  lerDados: (): Promise<Dados> => ipcRenderer.invoke('dados:ler'),
  salvarDados: (dados: Dados): Promise<void> => ipcRenderer.invoke('dados:salvar', dados),
  abrirLink: (url: string): Promise<boolean> => ipcRenderer.invoke('link:abrir', url)
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)

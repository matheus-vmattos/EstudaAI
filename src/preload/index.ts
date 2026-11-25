import { contextBridge, ipcRenderer } from 'electron'
import type {
  ConfigDoBloco,
  Dados,
  EstadoDaAtualizacao,
  ItemDaCaixa,
  NotaDoBloco,
  Retorno
} from '../shared/tipos'
import type { EstadoDaNuvem } from '../shared/sincronizar'

type Resposta = { ok?: true; confirmar?: true; erro?: string }

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
  procurarAtualizacao: (): Promise<void> => ipcRenderer.invoke('atualizacao:procurar'),
  fazerBackup: (dados: Dados): Promise<number> => ipcRenderer.invoke('dados:backup', dados),
  abrirPastaDosDados: (): Promise<string> => ipcRenderer.invoke('dados:abrirPasta'),
  caixaListar: (): Promise<{ itens: ItemDaCaixa[] } | { erro: string }> =>
    ipcRenderer.invoke('caixa:listar'),
  caixaArquivo: (nome: string): Promise<{ texto: string } | { erro: string }> =>
    ipcRenderer.invoke('caixa:arquivo', nome),
  reiniciarParaAtualizar: (): Promise<void> => ipcRenderer.invoke('atualizacao:reiniciar'),
  nuvemEstado: (): Promise<EstadoDaNuvem> => ipcRenderer.invoke('nuvem:estado'),
  aoMudarNuvem: (fn: (e: EstadoDaNuvem) => void): (() => void) => {
    const ouvir = (_: unknown, e: EstadoDaNuvem): void => fn(e)
    ipcRenderer.on('nuvem:estado', ouvir)
    return () => ipcRenderer.removeListener('nuvem:estado', ouvir)
  },
  nuvemEntrar: (email: string, senha: string): Promise<Resposta> =>
    ipcRenderer.invoke('nuvem:entrar', email, senha),
  nuvemCriarConta: (email: string, senha: string): Promise<Resposta> =>
    ipcRenderer.invoke('nuvem:criarConta', email, senha),
  nuvemSair: (): Promise<void> => ipcRenderer.invoke('nuvem:sair'),
  nuvemSincronizar: (): Promise<void> => ipcRenderer.invoke('nuvem:sincronizar'),
  nuvemRetornos: (): Promise<Retorno[] | null> => ipcRenderer.invoke('nuvem:retornos'),
  /** bloco de notas flutuante (0.1.24+) */
  bloco: {
    abrir: (notaId?: string): Promise<void> => ipcRenderer.invoke('bloco:abrir', notaId),
    fechar: (): Promise<void> => ipcRenderer.invoke('bloco:fechar'),
    config: (): Promise<ConfigDoBloco> => ipcRenderer.invoke('bloco:config'),
    mudarConfig: (patch: Partial<ConfigDoBloco>): Promise<ConfigDoBloco> =>
      ipcRenderer.invoke('bloco:mudarConfig', patch),
    ler: (): Promise<{ notas: NotaDoBloco[]; selecionar: string | null }> =>
      ipcRenderer.invoke('bloco:ler'),
    /** da janelinha: a lista nova vai para a janela principal gravar */
    salvar: (notas: NotaDoBloco[]): Promise<void> => ipcRenderer.invoke('bloco:salvar', notas),
    /** da principal: o que ficou valendo vai para a janelinha */
    publicar: (notas: NotaDoBloco[]): void => ipcRenderer.send('bloco:publicar', notas),
    aoAplicar: (fn: (notas: NotaDoBloco[]) => void): (() => void) => {
      const ouvir = (_: unknown, n: NotaDoBloco[]): void => fn(n)
      ipcRenderer.on('bloco:aplicar', ouvir)
      return () => ipcRenderer.removeListener('bloco:aplicar', ouvir)
    },
    aoMudar: (fn: (notas: NotaDoBloco[]) => void): (() => void) => {
      const ouvir = (_: unknown, n: NotaDoBloco[]): void => fn(n)
      ipcRenderer.on('bloco:mudou', ouvir)
      return () => ipcRenderer.removeListener('bloco:mudou', ouvir)
    },
    aoSelecionar: (fn: (id: string) => void): (() => void) => {
      const ouvir = (_: unknown, id: string): void => fn(id)
      ipcRenderer.on('bloco:selecionar', ouvir)
      return () => ipcRenderer.removeListener('bloco:selecionar', ouvir)
    }
  },
  /** a nuvem pergunta à tela: trocar os dados ("nuvem:trocar") ou qual
   *  versão fica ("nuvem:conflito"); a tela responde com o id */
  aoPerguntarNuvem: <T>(
    canal: 'nuvem:trocar' | 'nuvem:conflito',
    fn: (p: T & { id: number }) => void
  ): (() => void) => {
    const ouvir = (_: unknown, p: T & { id: number }): void => fn(p)
    ipcRenderer.on(canal, ouvir)
    return () => ipcRenderer.removeListener(canal, ouvir)
  },
  /** síncrono: troca o arquivo pelos dados da nuvem se nada mudou aqui
   *  desde a decisão; devolve se trocou */
  aplicarTrocaDaNuvem: (): boolean => ipcRenderer.sendSync('nuvem:aplicarTroca'),
  responderNuvem: (id: number, resposta: string | null): void =>
    ipcRenderer.send('nuvem:resposta', id, resposta)
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)

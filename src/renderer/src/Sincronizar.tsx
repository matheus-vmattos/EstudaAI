import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { EstadoDaNuvem } from '../../shared/sincronizar'

/** estado da sincronização, vindo do processo principal */
export function useNuvem(): EstadoDaNuvem {
  const [estado, setEstado] = useState<EstadoDaNuvem>({
    situacao: 'desconectado',
    email: '',
    ultimaSync: 0,
    mensagem: ''
  })
  useEffect(() => {
    void window.api.nuvemEstado().then(setEstado)
    return window.api.aoMudarNuvem(setEstado)
  }, [])
  return estado
}

const haQuanto = (ms: number): string => {
  const min = Math.round((Date.now() - ms) / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  return `às ${new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

/** Rodapé do menu: onde os dados estão */
export function OndeEstaSalvo({ erroAoSalvar }: { erroAoSalvar: boolean }) {
  const n = useNuvem()
  if (erroAoSalvar) return <div style={{ color: 'var(--vermelho)' }}>NÃO CONSEGUI SALVAR</div>
  if (n.situacao === 'desconectado') return <div>SALVO NO PC</div>
  if (n.situacao === 'sincronizando')
    return <div style={{ color: 'var(--ciano)' }}>SINCRONIZANDO…</div>
  if (n.situacao === 'ok') return <div style={{ color: 'var(--verde)' }}>NA NUVEM</div>
  return (
    <div style={{ color: 'var(--ambar)' }} title={n.mensagem}>
      SALVO NO PC · SEM NUVEM
    </div>
  )
}

/** Configurações › Sincronizar entre PCs */
export function SecaoSincronizar() {
  const n = useNuvem()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'erro' | 'info'; texto: string } | null>(null)

  const enviar = async (e: FormEvent, criar: boolean): Promise<void> => {
    e.preventDefault()
    if (!email.trim() || !senha) {
      setAviso({ tipo: 'erro', texto: 'Preencha o e-mail e a senha.' })
      return
    }
    setOcupado(true)
    setAviso(null)
    const r = criar
      ? await window.api.nuvemCriarConta(email, senha)
      : await window.api.nuvemEntrar(email, senha)
    setOcupado(false)
    if (r.erro) setAviso({ tipo: 'erro', texto: r.erro })
    else if (r.confirmar)
      setAviso({
        tipo: 'info',
        texto: `Enviei um link de confirmação para ${email.trim()}. Abra o link (a página que abrir pode dar erro, tudo bem) e volte aqui para Entrar.`
      })
    else setSenha('')
  }

  return (
    <section aria-labelledby="titulo-nuvem">
      <h3 id="titulo-nuvem" className="secao">
        Sincronizar entre PCs
      </h3>
      {n.situacao === 'desconectado' ? (
        <form className="form-nuvem" onSubmit={(e) => void enviar(e, false)}>
          <label>
            E-mail
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="submit" className="botao principal" disabled={ocupado}>
              {ocupado ? 'Aguarde…' : 'Entrar'}
            </button>
            <button
              type="button"
              className="botao"
              disabled={ocupado}
              onClick={(e) => void enviar(e, true)}
            >
              Criar conta
            </button>
          </div>
        </form>
      ) : (
        <div className="linha-config">
          <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {n.situacao === 'ok' && (
              <span className="meta" style={{ color: 'var(--verde)' }}>
                ✓ Sincronizado {haQuanto(n.ultimaSync)}
              </span>
            )}
            {n.situacao === 'sincronizando' && (
              <span className="meta" style={{ color: 'var(--ciano)' }}>
                Sincronizando…
              </span>
            )}
            <span>{n.email}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="botao"
              disabled={n.situacao === 'sincronizando'}
              onClick={() => void window.api.nuvemSincronizar()}
            >
              Sincronizar agora
            </button>
            <button type="button" className="botao" onClick={() => void window.api.nuvemSair()}>
              Sair
            </button>
          </div>
        </div>
      )}
      {n.mensagem && n.situacao !== 'ok' && (
        <div className={`aviso ${n.situacao === 'semInternet' ? 'info' : 'erro'}`} role="alert">
          {n.mensagem}
        </div>
      )}
      {aviso && (
        <div className={`aviso ${aviso.tipo}`} role={aviso.tipo === 'erro' ? 'alert' : 'status'}>
          {aviso.texto}
        </div>
      )}
    </section>
  )
}

const quando = (ms: number): string => {
  if (!ms) return ''
  const d = new Date(ms)
  const hoje = new Date().toDateString() === d.toDateString()
  return hoje
    ? `hoje ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Os dois PCs mudaram desde a última sincronização: a pessoa escolhe
 *  qual fica; a outra versão vai para os backups */
export function ConflitoDaNuvem() {
  const [pergunta, setPergunta] = useState<{
    id: number
    esteMudouEm: number
    outroMudouEm: number
    outroAparelho: string
  } | null>(null)
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(
    () =>
      window.api.aoPerguntarNuvem<{
        esteMudouEm: number
        outroMudouEm: number
        outroAparelho: string
      }>('nuvem:conflito', setPergunta),
    []
  )
  useEffect(() => {
    if (pergunta) ref.current?.showModal()
  }, [pergunta])
  if (!pergunta) return null
  const responder = (r: 'este' | 'outro' | null): void => {
    window.api.responderNuvem(pergunta.id, r)
    setPergunta(null)
  }
  return (
    <dialog ref={ref} onClose={() => responder(null)} aria-labelledby="conflito-titulo">
      <h2 id="conflito-titulo">Os dois PCs mudaram</h2>
      <p>Qual versão continua? A outra fica guardada nos backups.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" className="botao principal" onClick={() => responder('este')}>
          Este PC{pergunta.esteMudouEm ? ` · mudou ${quando(pergunta.esteMudouEm)}` : ''}
        </button>
        <button type="button" className="botao" onClick={() => responder('outro')}>
          {pergunta.outroAparelho ? `O outro PC (${pergunta.outroAparelho})` : 'O outro PC'} · mudou{' '}
          {quando(pergunta.outroMudouEm)}
        </button>
      </div>
    </dialog>
  )
}

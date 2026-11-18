const CAMINHOS = {
  marca: 'M12 2 22 7v10l-10 5L2 17V7zM2 7l10 5 10-5M12 12v10',
  nota: 'M5 3h10l4 4v14H5zM9 11h6M9 15h6',
  cartas: 'M3 6h14v12H3zM7 3h14v12',
  mapa: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M10 10 5.5 6.5M14 10l4.5-3.5M12 15v4M4 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4M20 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4M12 19a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  relogio: 'M9 4h6M12 4v3M12 7a7 7 0 1 0 0 14 7 7 0 0 0 0-14M12 10v4l2 2',
  busca: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-4-4',
  abaixo: 'm6 9 6 6 6-6',
  direita: 'm9 6 6 6-6 6',
  esquerda: 'M15 6l-6 6 6 6',
  mais: 'M12 5v14M5 12h14',
  lapis: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  lixo: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  externo: 'M7 17 17 7M9 7h8v8',
  play: 'M8 5v14l11-7z',
  doc: 'M5 3h10l4 4v14H5z',
  globo: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  copiar: 'M8 8h12v12H8zM4 16V4h12',
  enviar: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  pausa: 'M7 5h3v14H7zM14 5h3v14h-3z',
  check: 'M5 12l5 5L20 7',
  olho: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  engrenagem:
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  pasta: 'M3 6h6l2 2h10v11H3z',
  fechar: 'M6 6l12 12M18 6 6 18',
  atualizar: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  alvo: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2'
} as const

export type NomeDoIcone = keyof typeof CAMINHOS

export function Icone({
  nome,
  tamanho = 18,
  cheio = false
}: {
  nome: NomeDoIcone
  tamanho?: number
  cheio?: boolean
}) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill={cheio ? 'currentColor' : 'none'}
      stroke={cheio ? 'none' : 'currentColor'}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={CAMINHOS[nome]} />
    </svg>
  )
}

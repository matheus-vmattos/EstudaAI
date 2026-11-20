# EstudaAI

App de estudo para concurso do Matheus (Electron + React + TypeScript).
Concurso atual: **Banestes · Técnico Bancário, banca FCC, prova em
24/01/2027** (edital em `conteudo/banestes-tb-edital.json`). O objetivo de
tudo, tela ou conteúdo, é a **maior chance de aprovação nesse edital**.

## O edital (Banestes 2026, FCC) — o que importa para estudar

Fonte: edital de abertura retificado nº 01/2026,
https://banestes.com.br/publicacoes_legais/editais_concurso/2026/concurso2026-banestes-edital-abertura-retificado-01_2026.pdf
(capítulos 9, 11 e 12; conteúdo programático no Anexo IV, já em
`conteudo/banestes-tb-edital.json`).

- Cargo: Técnico Bancário (TB), cadastro de reserva, 30 h, R$ 4.552,43.
- Prova objetiva única, **4 h**, **70 questões de múltipla escolha com 5
  alternativas** (A–E). Domingo, 24/01/2027 (Vitória, São Mateus ou
  Cachoeiro de Itapemirim).
- **Conhecimentos Gerais (30 questões, peso 1):** Língua Portuguesa 10 ·
  Matemática/Raciocínio Lógico e Quantitativo 10 · Atualidades do Mercado
  Financeiro 5 · Ética, Compliance e ESG 5.
- **Conhecimentos Específicos (40 questões, peso 2):** Conhecimentos
  Bancários 15 · Matemática Financeira 5 · Noções de Probabilidade e
  Estatística 5 · Noções de Informática e Comportamentos Digitais 5 ·
  Vendas, Negociação e Atendimento 10.
- **Nota:** cada prova vale de 0 a 10; nota final = (Gerais × 1 +
  Específicos × 2) ÷ 3. **Aprovado com nota ≥ 6,00** (item 11.3). Não há
  mínimo por prova nem por matéria; o edital não prevê desconto por erro.
- **Desempate (12.3):** idade (Estatuto da Pessoa Idosa) → **mais acertos
  nos Específicos** → **mais acertos em Língua Portuguesa** → maior idade →
  jurado. Por isso Específicos e Português pesam ainda mais.
- Classificação por polo, depois da avaliação biopsicossocial e da
  heteroidentificação; o corte vem só depois delas.
- Quanto cada questão vale na nota final (as provas viram 0–10 antes do
  peso): **Específicos 0,167 ponto** (10 ÷ 40 × 2/3), **Gerais 0,111 ponto**
  (10 ÷ 30 × 1/3), ou seja, 1,5 ×. Bancários sozinho = 2,5 pontos (25% da
  nota); Vendas 1,67; Português e Matemática/RL 1,11 cada.

## Conteúdo (regra do dono — nunca esquecer)

Todo conteúdo que o Claude cria (questões, cartões, missões, resumos) segue:

1. **Base certa.** Cada fato é conferido numa fonte primária antes de
   publicar: lei no planalto.gov.br (texto compilado, a redação vigente),
   norma no bcb.gov.br (resoluções CMN/BCB), CVM, Susep, Tesouro Nacional,
   ANPD. Memória não é fonte: a lei muda (ex.: a Lei 15.352/2026 mudou o nome
   da ANPD para Agência Nacional de Proteção de Dados).
2. **Pro objetivo dele.** Só o que o edital cobra, no estilo da banca (FCC:
   5 alternativas A–E, enunciado direto, pegadinhas de exceção e de prazo),
   e priorizado pelo peso da matéria na nota e pelos dados de estudo dele
   (lacunas, enganos, matérias nunca medidas).
3. **Sem número que muda toda semana** (Selic do dia, cotações). Se não deu
   para conferir um fato, ele fica de fora, e isso é dito no resumo.
4. Gabaritos distribuídos entre A e E; alternativas numéricas em ordem
   crescente.
5. Cada arquivo de conteúdo lista as fontes conferidas no campo `fontes`.

## Como trabalhar

- Fluxo: implementar → PR (rascunho, depois pronto para revisão) → CI e
  revisão do Codex → corrigir o que for real (reproduzir antes) → merge.
  Subir `version` no package.json publica uma versão nova (release no push
  para main). Conteúdo só em `conteudo/` não precisa de versão.
- Tela nova ou redesenho: mockup no canvas
  https://claude.ai/artifact/CoZchKa9CUnpWWDmBaZmVA aprovado pelo dono antes.
- `npm test` e `npm run typecheck` antes de qualquer PR; e2e com Playwright
  `_electron` no Xvfb para o que precisa do app aberto.
- Dados do dono na nuvem (Supabase, projeto `jkmgrwtsdusrwbkuvovm`, tabela
  `public.estudaai_dados`): só leitura, para acompanhar o estudo. Nunca
  alterar os dados dele por fora do app.
- Respostas ao dono: curtas e práticas, em português.

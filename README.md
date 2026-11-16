# EstudaAI

App de estudos para concurso, para uso individual, que roda no PC (Electron).

## Fase 1 (pronta)

- **Anotações**: Matéria → Assunto, escritas em Markdown, com marca-texto (`==texto==`), destaque de pegadinha e busca em tudo (Ctrl+K).
- **Links**: você cola o link e dá um nome curto ("Pronomes"). O quadro mostra só o nome e um clique abre o link no navegador.
- **Gerador de questões**: você escolhe tema, nível, formato (A–E ou certo/errado), quantidade, tempo e banca. O app monta o prompt para Claude ou GPT, você cola a resposta (ou o arquivo `.json`) e ele confere tudo antes de liberar o simulado.
- **Simulado com cronômetro**: mostra tempo restante e tempo gasto na questão. Tem pausa (que esconde as questões), marcação para revisar, atalhos de teclado (letra responde, ← → navega, espaço pausa), entrega automática quando o tempo acaba e gabarito com resolução e histórico.

- **Flashcards** (v0.1.3): baralhos por Matéria → Assunto, frente/verso e lacuna (`{{c1::texto}}`), agendamento FSRS (o do Anki), revisão em modo foco (espaço mostra, 1–4 responde) e "Virar flashcard" a partir de um trecho da anotação.
- **Mapa mental** (v0.1.3): montado da árvore de matérias, com tópicos e subtópicos (Tab cria, F2 renomeia), recolher/expandir, arrastar e zoom; o painel mostra a anotação e abre a revisão dos cartões.
- **Configurações** (engrenagem): procurar atualização na hora, fazer backup e abrir a pasta dos dados.

Próximas fases: backup na nuvem.

## Dados

Tudo fica num arquivo só no PC: `%APPDATA%/EstudaAI/estudaai.json`. A cada abertura o app faz uma cópia `.bak`. Se o arquivo não puder ser lido, ele é guardado à parte e nunca sobrescrito.

## Comandos

```bash
npm install
npm run dev        # abre o app em modo desenvolvimento
npm test           # testes
npm run build:win  # instalador Windows local (em dist/)
```

## Baixar e atualizar

- Instalador da última versão: https://github.com/matheus-vmattos/EstudaAI/releases/latest/download/EstudaAI-Setup.exe
- **Publicar versão nova:** aumente `version` no `package.json` e leve para o `main`. A ação "Release" gera o instalador e publica. O app instalado baixa sozinho (ao abrir e a cada 4 h) e mostra "vX pronta · Reiniciar" no rodapé do menu. Se você não clicar, a atualização instala quando o app fechar.

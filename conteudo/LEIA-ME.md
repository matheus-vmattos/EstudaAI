# Caixa "Do Claude"

O app EstudaAI lê `caixa.json` desta pasta (no branch `main`) e mostra os itens na tela **Do Claude**.

- `tipo: "estrutura"` → arquivo `.txt` com a árvore (recuo, traços ou ├─; `A · B` na mesma linha vira irmãos). 1º nível = matéria, 2º = assunto, abaixo = tópicos. Nomes iguais (sem ligar para acento) são aproveitados.
- `tipo: "simulado"` → arquivo `.json` no mesmo formato que o gerador de questões aceita.
- `tipo: "cartoes"` → arquivo `.json` `{ "materia": "...", "cartoes": [{ "lugar": ["Assunto", "Tópico"], "frente": "...", "verso": "..." }] }`. Frente com `{{c1::resposta::dica}}` vira lacuna (verso opcional, aparece como comentário). Lugar que não existe é criado; cartão com a mesma frente no mesmo lugar não duplica.
- `arquivo`: só nome simples (`a-z`, `0-9`, `-`, `.txt`/`.json`).
- Item novo vai no fim da lista; o app mostra o mais novo primeiro. Não reutilize um `id`.
- Esta pasta é pública: nada pessoal aqui.

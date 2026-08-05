# C.C GAMBIN ERP — publicação no GitHub Pages

## Por que https://ccgambin.github.io/ccgambin-erp/ não abria
No repositório os arquivos estavam dentro da pasta `CCGAMBIN-ERP/`.
O GitHub Pages só serve `index.html` que esteja na RAIZ da pasta publicada,
então a URL retornava 404 (página não encontrada).

## Como corrigir (5 passos)
1. No repositório `ccgambin-erp`, envie o CONTEÚDO desta pasta para a RAIZ
   (index.html, 404.html, .nojekyll, css/, js/) — não dentro de outra pasta.
2. Se existir a pasta antiga `CCGAMBIN-ERP/` no repositório, apague-a.
3. Settings > Pages > Source: "Deploy from a branch",
   Branch: `main`, Folder: `/ (root)` > Save.
4. Aguarde 1–2 minutos e acesse https://ccgambin.github.io/ccgambin-erp/
5. Se aparecer versão antiga, atualize com Ctrl+Shift+R.

## O que foi adicionado
- `.nojekyll`: impede o Jekyll de ignorar arquivos/pastas do site.
- `404.html`: cópia do index, evita erro ao abrir links diretos com #/rota.
- Todos os caminhos já são relativos (`css/styles.css`, `js/...`), funcionam
  em subpasta como `/ccgambin-erp/`.

O código JS foi verificado arquivo por arquivo: sintaxe válida em todos
os 21 arquivos e todos os globais usados (DB, UI, Auth, Cloud, Modulos)
estão definidos e carregados na ordem correta no index.html.

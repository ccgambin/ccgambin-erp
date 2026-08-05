# C.C GAMBIN ERP v1.3

Sistema 100% estático (HTML + CSS + JS puro), **sem subpastas** — todos os arquivos ficam na raiz do repositório.

## Publicar no GitHub Pages
1. Envie **todos** os arquivos deste pacote para a **raiz** do repositório `ccgambin-erp` (branch `main`).
2. Settings → Pages → Source: **Deploy from a branch** → Branch `main` → pasta `/ (root)` → Save.
3. Aguarde 1-2 min e acesse: https://ccgambin.github.io/ccgambin-erp/

## Importante
- O arquivo `.nojekyll` deve estar na raiz (evita que o GitHub ignore arquivos).
- Não crie pastas `js/` ou `css/`: o `index.html` referencia os arquivos direto (`storage.js`, `styles.css`...).
- Nomes de arquivos são minúsculos (GitHub é sensível a maiúsculas/minúsculas).
- Login padrão: usuário `admin` / senha `admin`.

## Módulos
Dashboard, Produtos, Estoque, Movimentação, Pessoas, Negócios, Financeiro, Contas, Relatórios,
Certificados Digitais (A1/A3), Notas Fiscais (emissão/cancelamento NF-e, XML, backup), Sistema, Configurações.

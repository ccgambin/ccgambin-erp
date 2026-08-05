# C.C GAMBIN ERP v1.3

Sistema web (HTML + CSS + JavaScript puro, sem build) com produtos, estoque,
entrada/saída de mercadorias, vendedores, fornecedores, compras, vendas com
comissão, fluxo de caixa, contas a pagar/receber, relatórios, usuários,
**emissão e cancelamento de NF-e** e **certificado digital A1/A3**.

## Publicar no GitHub Pages

1. Crie (ou abra) o repositório `ccgambin-erp` na sua conta.
2. Envie **o conteúdo desta pasta na raiz do repositório** — o `index.html`
   precisa ficar na raiz, não dentro de uma subpasta.
3. Vá em **Settings → Pages**.
   - Opção simples: *Source* = **Deploy from a branch**, Branch = `main`, pasta `/ (root)`.
   - Opção automática: *Source* = **GitHub Actions** (o workflow
     `.github/workflows/pages.yml` já está incluído).
4. Aguarde 1–2 minutos e acesse: `https://<seu-usuario>.github.io/ccgambin-erp/`

## Arquivos importantes

- `index.html` — carrega todos os scripts na ordem correta.
- `404.html` — cópia do index para links diretos não darem erro.
- `.nojekyll` — impede o Jekyll de ignorar arquivos do projeto.
- `css/styles.css`, `js/*.js` — código da aplicação (caminhos **relativos**, funcionam em subpasta).

## Acesso inicial

- Usuário: `admin`
- Senha: `123456`

## Módulo fiscal

- **Certificado Digital**: A1 (`.pfx`/`.p12`, guardado somente no navegador) e A3 (token/cartão via PKCS#11), com validade e backup.
- **Notas Fiscais (NF-e)**: emissão com XML 4.00, chave de acesso de 44 dígitos, DANFE simplificado, cancelamento com XML de evento, exportação em ZIP/CSV e backup/restauração em JSON.

Os dados ficam no `localStorage` do navegador, com sincronização opcional no Firebase (Configurações).

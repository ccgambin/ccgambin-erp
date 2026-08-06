# DIAGNÓSTICO — Módulo Fiscal / Certificado A3 (C.C GAMBIN ERP v1.5)

Análise arquivo por arquivo do ERP enviado e do Agente Local v1.1.
Cada item traz **onde estava**, **por que quebrava** e **o que foi feito** na v2.0.

---

## A. Por que o certificado A3 nunca "instalava"

### A1. O Chrome/Edge bloqueava a conexão com o agente (causa nº 1)
- **Onde:** `agente/servidor.js` → `responder()` (v1.1, linhas 25-36) e o tratamento de `OPTIONS` (linha 69).
- **Problema:** a página roda em `https://ccgambin.github.io` e o agente em `http://127.0.0.1:8712`.
  Desde o Chrome 104+ (e obrigatório nas versões atuais) isso é uma requisição **Private Network Access**:
  o navegador manda um *preflight* com `Access-Control-Request-Private-Network: true` e **descarta a resposta**
  se ela não trouxer `Access-Control-Allow-Private-Network: true`. O agente respondia normalmente, o navegador
  jogava fora, e o ERP mostrava **"AGENTE DESCONECTADO"** para sempre.
- **Corrigido:** `servidor.js` v2.0 responde `Access-Control-Allow-Private-Network: true`,
  `Access-Control-Max-Age` e `Vary: Origin, Access-Control-Request-Private-Network` em **todas** as respostas,
  inclusive no preflight `OPTIONS`.

### A2. PowerShell em modo não interativo impedia o PIN do token (causa nº 2)
- **Onde:** `agente/deteccao.js` linha 22 — `["-NoProfile", "-NonInteractive", ...]`, usado também por `validacao.js`.
- **Problema:** ler a chave privada de um A3 faz o driver (SafeNet, Watchdata, Gemalto…) abrir a janela de PIN.
  Com `-NonInteractive` **essa janela nunca aparece**: a chamada falha em silêncio e o certificado aparece
  como "sem chave privada" ou a validação retorna erro genérico.
- **Corrigido:** removido `-NonInteractive`, acrescentado `-STA`, `windowsHide: false` e timeout de 180 s.

### A3. Detecção nunca classificava o certificado como A3
- **Onde:** `agente/deteccao.js`, dentro de `detectar()`:
  `certificados.map((c) => c.tipo === "A3" || c.hardware ? c : c)` — os dois ramos devolvem **o mesmo objeto**.
- **Problema:** o cruzamento entre tokens PKCS#11 encontrados e certificados do repositório era um *no-op*.
- **Corrigido:** cruzamento real por fabricante/rótulo do token × provedor (CSP/KSP) do certificado.

### A4. Timeouts curtos demais
- **Onde:** `deteccao.js` linha 15 (`timeout: 60000`) x `validacao.js` (`-TimeoutSec 60`, `--max-time 60`).
- **Problema:** o Node matava o PowerShell **no mesmo instante** em que a SEFAZ ainda respondia; com PIN
  digitado à mão, 60 s acabam antes do usuário.
- **Corrigido:** 120 s no HTTP e 180-300 s no processo.

### A5. Validação de A1 (.pfx) sempre falhava na etapa ICP-Brasil
- **Onde:** `agente/validacao.js`, em `validar()`:
  `exec("openssl", ["pkcs12", "-in", "-", ...], { input: undefined })`.
- **Problema:** manda o OpenSSL ler o PFX de **stdin** (`-in -`), mas nada é escrito no stdin, e o
  `-out` nunca foi informado. O `.cer` jamais era criado; mesmo assim o caminho seguia adiante.
- **Corrigido:** o PFX é gravado em arquivo temporário e extraído com
  `openssl pkcs12 -in <pfx> -clcerts -nokeys -out <cer>` (com *fallback* sem `-legacy` para OpenSSL 1.x).
  Os temporários são apagados ao final.

### A6. Origens aceitas pelo agente eram estreitas
- **Onde:** `servidor.js`, `origemPermitida()`.
- **Problema:** `^https:\/\/[a-z0-9-]+\.lovable\.app$` não cobre domínio próprio nem subdomínios com ponto.
- **Corrigido:** regex ampliada (github.io, *.lovable.app, *.lovableproject.com, ccgambin.com/.com.br, localhost).

### A7. Front-end só tentava um host e não explicava o bloqueio
- **Onde:** `agente-local.js` linha 5 (`BASE` fixo) e o `catch` que traduzia todo `TypeError` em `AGENTE_OFFLINE`.
- **Corrigido:** tenta `127.0.0.1` **e** `localhost`, e a mensagem de erro agora orienta o usuário a liberar
  "Acesso à rede local" no cadeado do Chrome quando a página está em HTTPS.

---

## B. Por que o módulo de Nota Fiscal "não funcionava"

**A emissão era 100% simulada.** Nada saía do navegador.

### B1. Protocolo de autorização inventado
- **Onde:** `notas.js`, no `submit` do formulário:
  `nota.protocolo = { numero: "9" + Fiscal.pad(Date.now()...), status: "100", motivo: "Autorizado o uso da NF-e" }`.
- **Problema:** a nota era gravada como **EMITIDA** com um protocolo fabricado localmente. A SEFAZ nunca foi
  consultada; o XML gerado não tem validade fiscal nenhuma.

### B2. Assinatura digital falsa
- **Onde:** `notas.js` → `base64Digest()` (linha 17) e `fiscal.js` → bloco `<Signature>`.
  `nota.assinatura = { digest: digest, valor: digest + digest, certificado: "A3-TOKEN-..." }`.
- **Problema:** `SignatureValue` era o digest repetido duas vezes e `X509Certificate` um texto qualquer.
  Não é XMLDSig; qualquer validador rejeita.

### B3. Nenhum webservice de emissão estava mapeado
- **Onde:** `agente/config.js` — só existia `NFeStatusServico4`.
- **Problema:** não havia `NFeAutorizacao4`, `NFeRetAutorizacao4`, `NFeConsultaProtocolo4` nem
  `NFeRecepcaoEvento4`. Ou seja: **não havia como emitir**, só perguntar se a SEFAZ estava no ar.

### B4. Cancelamento também simulado
- **Onde:** `notas.js`, `#frmCanc` → `protocolo: "1" + Date.now()`, e `fiscal.js` → `xmlCancelamento()`
  já devolvia um `retEvento` com `cStat 135` escrito à mão.

### B5. `dhEmi` em UTC — rejeição garantida
- **Onde:** `fiscal.js` → `"<dhEmi>" + (nota.dhEmi || new Date().toISOString())`.
- **Problema:** `toISOString()` termina em `Z`; o layout 4.00 exige `AAAA-MM-DDThh:mm:ss-03:00`.
  Assim que a nota fosse realmente transmitida, viria rejeição de data/hora de emissão inválida.
- **Corrigido:** `Fiscal.dataHoraSefaz()` com deslocamento de fuso.

### B6. `verProc` desatualizado
- `CCGAMBIN-ERP-1.4` em um pacote 1.5 → agora `CCGAMBIN-ERP-2.0`.

---

## C. O que a v2.0 passou a fazer de verdade

| Etapa | Órgão / webservice | Como |
|---|---|---|
| Status do serviço | `NFeStatusServico4` | mTLS com o certificado ativo |
| Cadeia e revogação | ICP-Brasil / ITI (CRL + OCSP) | `certutil -verify -urlfetch` |
| **Emissão** | **`NFeAutorizacao4`** (lote síncrono, `indSinc=1`) | XML assinado pelo CSP/KSP do Windows |
| **Consulta** | **`NFeConsultaProtocolo4`** | por chave de acesso |
| **Cancelamento** | **`NFeRecepcaoEvento4`** (evento 110111) | evento assinado + protocolo |

Assinatura: `assinar-enviar.ps1` usa `System.Security.Cryptography.Xml.SignedXml`
(RSA-SHA1, C14N, transformada *enveloped*, `KeyInfo/X509Data`) exatamente como o MOC da NF-e exige.
**A chave privada do A3 nunca é extraída** — quem assina é o próprio token, via CSP/KSP.
Ao autorizar, o agente devolve o `nfeProc` (NFe assinada + protNFe) pronto para guardar os 5 anos.

Autorizadores cobertos: SVRS (AC, AL, AP, DF, ES, MA, PA, PB, PI, RJ, RN, RO, RR, RS, SC, SE, TO),
SP, MG, PR, BA, GO, MS, MT, PE, AM, CE — produção e homologação.

---

## D. O que ainda depende de você (não dá para resolver no código)

1. **Windows.** A assinatura com token A3 usa o CSP/KSP do Windows. Em Linux/macOS só funciona A1 (.pfx).
2. **Driver do token** instalado (SafeNet/Watchdata/Gemalto/etc.) e o certificado visível em
   `certmgr.msc → Pessoal`.
3. **Credenciamento na SEFAZ** da sua UF e Inscrição Estadual habilitada para NF-e.
4. **Cadastro completo em Configurações**: CNPJ, IE, CRT, endereço e **código IBGE do município**
   (7 dígitos) — sem ele a rejeição é imediata.
5. **Homologação primeiro** (ambiente 2). Só mude para produção depois de uma nota autorizada em teste.
6. **Regras tributárias**: o XML atual assume Simples Nacional (CSOSN, PIS/COFINS CST 07). Empresa no
   Lucro Presumido/Real precisa dos grupos ICMS00/20/…, IPI e alíquotas reais.

---

## E. Como instalar e testar

1. Descompacte o pacote e instale o **Node.js LTS** (https://nodejs.org).
2. Entre na pasta `agente` e execute **`instalar.bat`** (Windows) — ele registra a inicialização automática.
3. Conecte o token A3 e abra o ERP → **Certificado Digital** → *Detectar certificados*.
4. Se o Chrome mostrar "agente desconectado" mesmo com a janela do agente aberta:
   cadeado da barra de endereços → *Configurações do site* → **Acesso à rede local: Permitir**.
5. Valide o certificado (ambiente **Homologação**) e só então emita a primeira nota de teste.

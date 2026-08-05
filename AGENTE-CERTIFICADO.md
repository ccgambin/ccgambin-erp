# Certificado Digital A3 — instalação automática e validação oficial (v1.4)

O módulo **Certificado Digital** do ERP agora:

1. **Busca sozinho** os certificados já instalados no computador (repositório do Windows + tokens A3),
   preenchendo titular, CNPJ/CPF, AC emissora, validade, provedor e impressão digital.
2. **Testa a validade junto aos órgãos responsáveis**:
   - **ITI / ICP-Brasil** — cadeia de confiança + revogação CRL/OCSP (`certutil -verify -urlfetch`)
   - **SEFAZ da UF** — autenticação mTLS real no webservice `NFeStatusServico4`; `cStat 107` = certificado aceito
3. **Gera downloads** de tudo: inventário da máquina (JSON), relatório de validação (TXT e JSON),
   backup dos certificados (JSON), planilha de certificados (CSV) e o próprio `.pfx` do A1.

Isso exige o **Agente Local** (pasta `agente/`) — um navegador, por segurança, não consegue ler
o repositório do Windows nem falar com um token PKCS#11. Veja `agente/LEIA-ME.md`.

## Arquivos alterados/criados

| Arquivo | O que é |
|---|---|
| `certificados.js` | módulo reescrito: agente, detecção automática, validação, relatórios |
| `agente-local.js` | cliente HTTP do agente (`window.Agente`) |
| `index.html` | carrega `agente-local.js` |
| `agente/servidor.js` | servidor local 127.0.0.1:8712 |
| `agente/deteccao.js` | leitura do repositório do Windows/NSS + PKCS#11 |
| `agente/validacao.js` | ICP-Brasil (certutil) + SEFAZ (mTLS) |
| `agente/config.js` | endpoints oficiais NFeStatusServico4 por UF/ambiente |
| `agente/instalar.bat` / `agente/iniciar.sh` | instaladores |

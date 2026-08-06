/* Certificado Digital — instalação A1 (arquivo .pfx/.p12) e A3 (token/cartão/repositório),
   com DETECÇÃO AUTOMÁTICA dos certificados instalados no computador (Agente Local)
   e VALIDAÇÃO REAL junto aos órgãos responsáveis (ICP-Brasil/ITI + SEFAZ via mTLS). */
(function (w) {
  w.Modulos = w.Modulos || {};

  var UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR",
    "PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

  var estado = {
    tipo: "A3",
    arquivo: null,
    editando: null,
    agente: { verificando: false, online: null, info: null, erro: null },
    deteccao: { carregando: false, dados: null, erro: null, selecionado: null },
    validando: null,
    resultado: null
  };

  /* ------------------------------------------------------------------ dados */
  function lista() { return DB.read("certificados"); }
  function ativo() { return lista().filter(function (c) { return c.ativo; })[0] || null; }
  function ativar(id) {
    DB.write("certificados", lista().map(function (c) {
      return Object.assign({}, c, { ativo: c.id === id });
    }));
  }
  function diasRestantes(c) {
    if (!c || !c.validade) return null;
    return Math.ceil((new Date(c.validade + "T23:59:59") - new Date()) / 86400000);
  }
  function situacao(c) {
    var d = diasRestantes(c);
    if (d == null) return { texto: "Sem validade", tipo: "info" };
    if (d < 0) return { texto: "VENCIDO", tipo: "bad" };
    if (d <= 30) return { texto: "VENCE EM " + d + " DIAS", tipo: "warn" };
    return { texto: "VÁLIDO (" + d + " dias)", tipo: "ok" };
  }
  var SELOS = {
    VALIDADO: ["HOMOLOGADO SEFAZ", "ok"],
    REVOGADO: ["REVOGADO", "bad"],
    VENCIDO: ["VENCIDO", "bad"],
    SEFAZ_INDISPONIVEL: ["SEFAZ FORA DO AR", "warn"],
    SEM_COMUNICACAO: ["SEM COMUNICAÇÃO", "warn"],
    PENDENTE_TOKEN: ["AGUARDANDO TOKEN/PIN", "warn"],
    NAO_VALIDADO: ["NÃO ACEITO", "bad"]
  };
  function selo(c) {
    var v = c && c.validacao;
    if (!v) return UI.badge("NÃO VALIDADO", "info");
    var s = SELOS[v.situacao] || ["FALHOU", "warn"];
    return UI.badge(s[0], s[1]);
  }

  function base64(arrayBuffer) {
    var bytes = new Uint8Array(arrayBuffer), s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function paraBlob(b64, tipo) {
    var bin = atob(b64 || ""), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: tipo || "application/x-pkcs12" });
  }
  function ufPadrao() {
    var cfg = DB.config();
    return (cfg.uf || cfg.estado || "RS").toUpperCase();
  }

  /* -------------------------------------------------------------- agente */
  /* Vigia permanente: assim que o agente sobe (ou cai), a tela se atualiza
     sozinha — o usuário não precisa clicar em "Reconectar". */
  var vigia = null;
  function iniciarVigia() {
    if (vigia || !w.Agente || !Agente.monitorar) return;
    vigia = Agente.monitorar(function (online, info) {
      var mudou = estado.agente.online !== online;
      estado.agente = {
        verificando: false, online: online, info: info,
        erro: online ? null : "Agente local não está em execução."
      };
      if (mudou) Router.refresh();
    }, 8000);
  }

  function verificarAgente(forcar) {
    iniciarVigia();
    if (estado.agente.verificando) return;
    if (!forcar && estado.agente.online !== null) return;
    estado.agente.verificando = true;
    Agente.status().then(function (info) {
      estado.agente = { verificando: false, online: true, info: info, erro: null };
      Router.refresh();
    }, function (e) {
      estado.agente = {
        verificando: false, online: false, info: null,
        erro: Agente.ehErroOffline(e) ? "Agente local não está em execução." : e.message
      };
      Router.refresh();
    })["catch"](function (e) { console.error("Falha ao renderizar o status do agente:", e); });
  }

  function detectarCertificados() {
    estado.deteccao = { carregando: true, dados: null, erro: null, selecionado: null };
    Router.refresh();
    Agente.detectar().then(function (r) {
      estado.deteccao = { carregando: false, dados: r, erro: null, selecionado: (r.certificados[0] || {}).thumbprint || null };
      estado.agente.online = true;
      Router.refresh();
    }, function (e) {
      estado.deteccao = {
        carregando: false, dados: null, selecionado: null,
        erro: Agente.ehErroOffline(e) ? "Agente local não está em execução. Instale e execute o CCGambin Agente Local." : e.message
      };
      Router.refresh();
    })["catch"](function (e) { console.error("Falha ao exibir a detecção:", e); });
  }

  function detectado(thumb) {
    var d = estado.deteccao.dados;
    if (!d) return null;
    return d.certificados.filter(function (c) { return c.thumbprint === thumb; })[0] || null;
  }

  /* ------------------------------------------------------------ validação */
  function validarRegistro(cert) {
    estado.validando = cert.id || cert.thumbprint;
    estado.resultado = null;
    Router.refresh();
    var payload = {
      uf: cert.uf || ufPadrao(),
      ambiente: cert.ambiente || "2",
      thumbprint: cert.thumbprint || undefined,
      pfxBase64: !cert.thumbprint && cert.arquivoBase64 ? cert.arquivoBase64 : undefined,
      senha: !cert.thumbprint ? cert.senha : undefined
    };
    Agente.validar(payload).then(function (r) {
      estado.validando = null;
      estado.resultado = Object.assign({ certificado: cert.titular || cert.thumbprint }, r);
      if (cert.id) {
        DB.update("certificados", cert.id, {
          validacao: {
            situacao: r.situacao, homologado: r.homologado, resumo: r.resumo, conclusivo: r.conclusivo, validadoEm: r.validadoEm,
            uf: r.uf, ambiente: r.ambiente,
            cStat: r.sefaz && r.sefaz.cStat, xMotivo: r.sefaz && r.sefaz.xMotivo,
            etapas: r.etapas
          }
        });
      }
      Router.refresh();
    }, function (e) {
      estado.validando = null;
      estado.resultado = {
        erro: Agente.ehErroOffline(e) ? "Agente local não está em execução." : e.message,
        certificado: cert.titular || cert.thumbprint
      };
      Router.refresh();
    })["catch"](function (e) { console.error("Falha ao exibir o resultado:", e); });
  }

  function relatorioValidacao(r) {
    var linhas = [];
    linhas.push("C.C GAMBIN ERP — RELATÓRIO DE VALIDAÇÃO DE CERTIFICADO DIGITAL");
    linhas.push("=".repeat(70));
    linhas.push("Certificado : " + (r.certificado || "-"));
    linhas.push("Data/hora   : " + new Date(r.validadoEm || Date.now()).toLocaleString("pt-BR"));
    linhas.push("UF/Ambiente : " + (r.uf || "-") + " / " + (String(r.ambiente) === "1" ? "Produção" : "Homologação"));
    linhas.push("Situação    : " + (r.situacao || "ERRO"));
    linhas.push("Duração     : " + (r.duracaoMs || 0) + " ms");
    linhas.push("");
    (r.etapas || []).forEach(function (e, i) {
      linhas.push((i + 1) + ") " + e.nome);
      linhas.push("   Órgão     : " + e.orgao);
      linhas.push("   Resultado : " + (e.ok ? "APROVADO" : e.alerta ? "ATENÇÃO" : "REPROVADO"));
      linhas.push("   Mensagem  : " + e.mensagem);
      if (e.detalhe) linhas.push("   Detalhe   : " + e.detalhe);
      if (e.ferramenta) linhas.push("   Método    : " + e.ferramenta);
      linhas.push("");
    });
    if (r.erro) linhas.push("ERRO: " + r.erro);
    linhas.push("=".repeat(70));
    linhas.push("Documento gerado automaticamente pelo C.C GAMBIN ERP.");
    return linhas.join("\n");
  }

  /* ----------------------------------------------------------- renderização */
  function cardAgente() {
    var a = estado.agente;
    var estadoTexto = a.verificando ? UI.badge("VERIFICANDO...", "info")
      : a.online ? UI.badge("AGENTE CONECTADO", "ok") : UI.badge("AGENTE DESCONECTADO", "bad");
    var info = a.online && a.info
      ? '<span class="hint">' + UI.esc(a.info.host + " · " + a.info.plataforma + " · agente v" + a.info.versao) + "</span>"
      : '<span class="hint">' + UI.esc(a.erro || "Verificando o agente local em " + Agente.BASE + "...") + "</span>";
    return '<div class="card"><div class="row" style="margin-bottom:8px">' +
      '<h2 style="margin:0">Agente Local de Certificado</h2>' + estadoTexto +
      '<button class="btn ghost right" id="agRever">Reconectar</button>' +
      '<button class="btn" id="agBaixar">Baixar agente</button></div>' + info +
      (a.online === false
        ? '<p class="hint" style="text-align:left;margin-top:10px">O agente lê os certificados instalados no seu computador ' +
          "(repositório do Windows e tokens A3) e conversa com a SEFAZ usando a chave privada sem nunca extraí-la. " +
          "Baixe, execute <b>instalar.bat</b> e clique em Reconectar.</p>"
        : "") + "</div>";
  }

  function tabelaDetectados() {
    var d = estado.deteccao;
    if (d.carregando) return '<p class="hint" style="text-align:left">Lendo os certificados instalados no computador...</p>';
    if (d.erro) return '<p class="hint" style="text-align:left;color:var(--bad,#c0392b)">' + UI.esc(d.erro) + "</p>";
    if (!d.dados) return '<p class="hint" style="text-align:left">Clique em “Detectar certificados do computador” para ler automaticamente o repositório do Windows e os tokens A3 conectados.</p>';
    var certs = d.dados.certificados || [];
    var resumo = '<p class="hint" style="text-align:left">' +
      UI.esc(certs.length + " certificado(s) encontrado(s) · " + (d.dados.tokens || []).length +
        " token(s) A3 · " + (d.dados.drivers || []).length + " driver(s) PKCS#11 · " + d.dados.plataforma) + "</p>";
    return resumo + UI.tabela([
      { label: "", render: function (c) {
          return '<input type="radio" name="detsel" data-sel="' + UI.esc(c.thumbprint) + '"' +
            (estado.deteccao.selecionado === c.thumbprint ? " checked" : "") + " />"; } },
      { label: "Tipo", render: function (c) { return UI.badge(c.tipo, c.tipo === "A1" ? "info" : "warn"); } },
      { label: "Titular", render: function (c) { return UI.esc(c.titular); } },
      { label: "CNPJ/CPF", render: function (c) { return c.documento ? Utils.mascaraDocumento(c.documento) : "-"; } },
      { label: "Emissor (AC)", render: function (c) { return UI.esc(c.emissor || "-"); } },
      { label: "Válido até", render: function (c) { return Utils.dataBR(c.validade); } },
      { label: "ICP-Brasil", render: function (c) { return c.icpBrasil ? UI.badge("SIM", "ok") : UI.badge("NÃO", "warn"); } },
      { label: "Origem", render: function (c) { return UI.esc(c.hardware ? "Token/Cartão" : (c.loja || c.origem || "")); } },
      { label: "Ações", render: function (c) {
          return '<button class="btn sm" data-usar="' + UI.esc(c.thumbprint) + '">Usar este</button> ' +
            '<button class="btn sm ghost" data-valdet="' + UI.esc(c.thumbprint) + '">Validar agora</button>'; } }
    ], certs, "Nenhum certificado com chave privada encontrado nesta máquina. Conecte o token A3 e detecte novamente.") +
    ((d.dados.tokens || []).length
      ? '<h3 style="margin:14px 0 6px">Tokens / cartões conectados</h3>' + UI.tabela([
          { label: "Fabricante", render: function (t) { return UI.esc(t.fabricante); } },
          { label: "Rótulo", render: function (t) { return UI.esc(t.rotulo); } },
          { label: "Slot", render: function (t) { return String(t.slot); } },
          { label: "Série", render: function (t) { return UI.esc(t.serie || "-"); } },
          { label: "Driver PKCS#11", render: function (t) { return UI.esc(t.driver); } }
        ], d.dados.tokens, "")
      : "") +
    ((d.dados.drivers || []).length
      ? '<h3 style="margin:14px 0 6px">Bibliotecas PKCS#11 instaladas</h3>' + UI.tabela([
          { label: "Fabricante", render: function (t) { return UI.esc(t.fabricante); } },
          { label: "Caminho", render: function (t) { return UI.esc(t.caminho); } }
        ], d.dados.drivers, "")
      : "");
  }

  function cardResultado() {
    var r = estado.resultado;
    if (!r) return "";
    if (r.erro) {
      return '<div class="card"><h2>Resultado da validação</h2>' +
        UI.badge("FALHA", "bad") + ' <span class="hint">' + UI.esc(r.erro) + "</span></div>";
    }
    var etapas = (r.etapas || []).map(function (e) {
      return '<div style="border-left:3px solid var(--line,#ddd);padding:8px 0 8px 12px;margin-bottom:10px">' +
        "<strong>" + UI.esc(e.nome) + "</strong> " +
        UI.badge(e.ok ? "APROVADO" : e.alerta ? "ATENÇÃO" : "REPROVADO", e.ok ? "ok" : e.alerta ? "warn" : "bad") +
        '<div class="hint" style="text-align:left;margin:4px 0 0">' + UI.esc(e.orgao) + "</div>" +
        '<div style="font-size:13px;margin-top:4px">' + UI.esc(e.mensagem) + "</div>" +
        (e.detalhe ? '<div class="hint" style="text-align:left;margin-top:2px">' + UI.esc(e.detalhe) + "</div>" : "") +
        "</div>";
    }).join("");
    return '<div class="card"><div class="row" style="margin-bottom:10px">' +
      '<h2 style="margin:0">Resultado da validação junto aos órgãos</h2>' +
      UI.badge((SELOS[r.situacao] || [r.situacao, "bad"])[0], (SELOS[r.situacao] || ["", "bad"])[1]) +
      '<button class="btn ghost right" id="baixarRel">Baixar relatório (.txt)</button>' +
      '<button class="btn ghost" id="baixarRelJson">Baixar JSON</button></div>' +
      (r.resumo ? '<p style="margin:0 0 6px;font-size:14px"><strong>' + UI.esc(r.resumo) + "</strong></p>" : "") +
      (r.conclusivo === false ? '<p class="hint" style="text-align:left">Resultado NÃO conclusivo: a falha foi de comunicação, não do certificado. Tente novamente em alguns minutos.</p>' : "") +
      '<p class="hint" style="text-align:left">' +
      UI.esc((r.certificado || "") + " · " + r.uf + " · " + (String(r.ambiente) === "1" ? "Produção" : "Homologação") +
        " · " + new Date(r.validadoEm).toLocaleString("pt-BR") + " · " + r.duracaoMs + " ms") + "</p>" +
      etapas + "</div>";
  }

  w.Modulos.certificados = function (el) {
    verificarAgente(false);

    var todos = lista();
    var atual = ativo();
    var e = estado.editando || {};
    var tipo = estado.editando ? (e.tipo || "A1") : estado.tipo;
    var a1 = tipo === "A1";
    var sit = atual ? situacao(atual) : null;
    var sel = estado.deteccao.selecionado ? detectado(estado.deteccao.selecionado) : null;

    var camposA1 =
      UI.campo("Arquivo do certificado (.pfx ou .p12)",
        '<input type="file" name="arquivo" id="arqCert" accept=".pfx,.p12,application/x-pkcs12" />') +
      UI.campo("Senha do certificado", UI.input("senha", { type: "password", value: e.senha, placeholder: "Senha do arquivo PFX" })) +
      UI.campo("Arquivo instalado", UI.input("arquivoNome", { value: e.arquivoNome, readonly: true, placeholder: "Nenhum arquivo selecionado" }));

    var camposA3 =
      UI.campo("Certificado detectado (impressão digital)",
        UI.input("thumbprint", { value: e.thumbprint || (sel && sel.thumbprint) || "", readonly: true, placeholder: "Use a detecção automática acima" })) +
      UI.campo("Repositório / origem",
        UI.input("repositorio", { value: e.repositorio || (sel && (sel.loja || sel.origem)) || "", readonly: true, placeholder: "Preenchido automaticamente" })) +
      UI.campo("Provedor criptográfico (CSP/KSP)",
        UI.input("provedor", { value: e.provedor || (sel && sel.provedor) || "", readonly: true, placeholder: "Preenchido automaticamente" })) +
      UI.campo("Biblioteca PKCS#11 (driver)",
        UI.input("driver", { value: e.driver || "", placeholder: "Detectada automaticamente quando houver token" }));

    el.innerHTML = UI.pagina("Certificado Digital",
      "Detecção automática dos certificados instalados no computador e validação junto à SEFAZ e à ICP-Brasil",
      '<div class="grid g4" style="margin-bottom:18px">' +
        UI.stat("Certificados instalados", todos.length, "c1") +
        UI.stat("Certificado ativo", UI.esc(atual ? atual.titular || "-" : "Nenhum"), atual ? "c2" : "c4") +
        UI.stat("Validação SEFAZ", atual ? selo(atual) : UI.badge("SEM CERTIFICADO", "bad"),
          atual && atual.validacao && atual.validacao.homologado ? "c2" : "c3") +
        UI.stat("Situação", sit ? UI.badge(sit.texto, sit.tipo) : UI.badge("-", "info"),
          sit && sit.tipo === "ok" ? "c2" : "c3") +
      "</div>" +

      cardAgente() +

      '<div class="card"><div class="row" style="margin-bottom:12px">' +
        '<h2 style="margin:0">Certificados instalados neste computador</h2>' +
        '<button class="btn right" id="detectar"' + (estado.deteccao.carregando ? " disabled" : "") + ">" +
        (estado.deteccao.carregando ? "Detectando..." : "Detectar certificados do computador") + "</button>" +
        '<button class="btn ghost" id="baixarDet">Baixar inventário</button>' +
      "</div>" + tabelaDetectados() + "</div>" +

      cardResultado() +

      '<div class="card"><h2>' + (estado.editando ? "Editar certificado" : "Instalar certificado") + "</h2>" +
      '<div class="row" style="margin-bottom:12px">' +
        '<button type="button" class="btn ' + (a1 ? "" : "ghost") + '" data-tipo="A1">A1 — arquivo (.pfx/.p12)</button>' +
        '<button type="button" class="btn ' + (a1 ? "ghost" : "") + '" data-tipo="A3">A3 — token / cartão / repositório</button>' +
      "</div>" +
      '<form id="frm"><div class="grid g2 linhas">' +
        UI.campo("Titular / Razão social", UI.input("titular", { value: e.titular || (!a1 && sel ? sel.titular : "") })) +
        UI.campo("CNPJ/CPF do titular", UI.input("documento", { value: e.documento || (!a1 && sel ? sel.documento : ""), mask: "documento" })) +
        UI.campo("Válido até", UI.input("validade", { type: "date", value: e.validade || (!a1 && sel ? sel.validade : "") })) +
        UI.campo("Ambiente de uso", UI.select("ambiente", Fiscal.AMBIENTES, e.ambiente || "2")) +
        UI.campo("UF da SEFAZ (validação)", UI.select("uf", UFS, e.uf || ufPadrao())) +
        (a1 ? camposA1 : camposA3) +
      "</div>" +
      '<p class="hint" style="text-align:left;margin:10px 0 8px">' +
      (a1 ? "O arquivo é gravado com segurança apenas neste navegador (armazenamento local) e nunca é enviado para terceiros."
          : "No A3 a chave privada nunca sai do token. O ERP referencia o certificado pela impressão digital e o agente local assina/autentica usando o próprio token — o PIN é pedido pelo driver a cada operação.") +
      "</p>" + UI.acoes(estado.editando, "Instalar certificado") + "</form></div>" +

      '<div class="card"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">Certificados cadastrados no ERP</h2>' +
      '<button class="btn ghost right" id="backup">Backup dos certificados</button>' +
      '<button class="btn ghost" id="csv">Exportar CSV</button></div>' +
      UI.tabela([
        { label: "Tipo", render: function (c) { return UI.badge(c.tipo, c.tipo === "A1" ? "info" : "warn"); } },
        { label: "Titular", chave: "titular" },
        { label: "CNPJ/CPF", render: function (c) { return Utils.mascaraDocumento(c.documento); } },
        { label: "Válido até", render: function (c) { return Utils.dataBR(c.validade); } },
        { label: "Situação", render: function (c) { var s = situacao(c); return UI.badge(s.texto, s.tipo); } },
        { label: "Validação órgãos", render: function (c) {
            var extra = c.validacao ? '<div class="hint" style="text-align:left">' +
              UI.esc((c.validacao.cStat ? "cStat " + c.validacao.cStat + " · " : "") +
                new Date(c.validacao.validadoEm).toLocaleString("pt-BR")) + "</div>" : "";
            return selo(c) + extra; } },
        { label: "Ambiente", render: function (c) { return c.ambiente === "1" ? "Produção" : "Homologação"; } },
        { label: "Status", render: function (c) { return c.ativo ? UI.badge("ATIVO", "ok") : UI.badge("inativo", "info"); } },
        { label: "Ações", render: function (c) {
            return '<button class="btn sm" data-validar="' + c.id + '"' + (estado.validando === c.id ? " disabled" : "") + ">" +
              (estado.validando === c.id ? "Validando..." : "Validar") + "</button> " +
              (c.ativo ? "" : '<button class="btn sm ghost" data-ativar="' + c.id + '">Ativar</button> ') +
              (c.tipo === "A1" && c.arquivoBase64 ? '<button class="btn sm ghost" data-baixar="' + c.id + '">Baixar .pfx</button> ' : "") +
              '<button class="btn sm ghost" data-edit="' + c.id + '">Editar</button> ' +
              '<button class="btn sm danger" data-del="' + c.id + '">Remover</button>'; } }
      ], todos, "Nenhum certificado instalado. Detecte o A3 do computador ou instale um A1 para emitir notas fiscais.") + "</div>");

    /* -------------------------------------------------------- eventos */
    Array.prototype.forEach.call(el.querySelectorAll("[data-tipo]"), function (b) {
      b.addEventListener("click", function () {
        estado.tipo = b.getAttribute("data-tipo");
        estado.editando = null;
        estado.arquivo = null;
        Router.refresh();
      });
    });

    var bRever = el.querySelector("#agRever");
    if (bRever) bRever.addEventListener("click", function () { verificarAgente(true); });

    var bAg = el.querySelector("#agBaixar");
    if (bAg) bAg.addEventListener("click", function () {
      alert("O instalador do agente está na pasta 'agente' do sistema: execute instalar.bat (Windows) ou iniciar.sh (Linux/macOS).");
    });

    el.querySelector("#detectar").addEventListener("click", detectarCertificados);

    el.querySelector("#baixarDet").addEventListener("click", function () {
      if (!estado.deteccao.dados) { alert("Detecte os certificados antes de baixar o inventário."); return; }
      Fiscal.baixar("inventario-certificados-" + Utils.hoje() + ".json",
        JSON.stringify(estado.deteccao.dados, null, 2), "application/json;charset=utf-8");
    });

    var arq = el.querySelector("#arqCert");
    if (arq) arq.addEventListener("change", function () {
      var f = arq.files && arq.files[0];
      if (!f) { estado.arquivo = null; return; }
      var r = new FileReader();
      r.onload = function () {
        estado.arquivo = { nome: f.name, base64: base64(r.result) };
        var campo = el.querySelector('[name="arquivoNome"]');
        if (campo) campo.value = f.name;
      };
      r.readAsArrayBuffer(f);
    });

    var bRel = el.querySelector("#baixarRel");
    if (bRel) bRel.addEventListener("click", function () {
      Fiscal.baixar("validacao-certificado-" + Utils.hoje() + ".txt",
        relatorioValidacao(estado.resultado), "text/plain;charset=utf-8");
    });
    var bRelJ = el.querySelector("#baixarRelJson");
    if (bRelJ) bRelJ.addEventListener("click", function () {
      Fiscal.baixar("validacao-certificado-" + Utils.hoje() + ".json",
        JSON.stringify(estado.resultado, null, 2), "application/json;charset=utf-8");
    });

    el.querySelector("#frm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var d = UI.dados(ev.target);
      delete d.arquivo;
      if (!d.titular) { alert("Informe o titular do certificado."); return; }
      if (!Utils.validarDocumento(d.documento)) { alert("CNPJ/CPF do titular inválido."); return; }
      if (!d.validade) { alert("Informe a data de validade do certificado."); return; }
      d.tipo = tipo;
      if (a1) {
        var anexo = estado.arquivo || (estado.editando && estado.editando.arquivoBase64
          ? { nome: estado.editando.arquivoNome, base64: estado.editando.arquivoBase64 } : null);
        if (!anexo) { alert("Selecione o arquivo .pfx ou .p12 do certificado A1."); return; }
        if (!d.senha) { alert("Informe a senha do certificado A1."); return; }
        d.arquivoNome = anexo.nome;
        d.arquivoBase64 = anexo.base64;
      } else if (!d.thumbprint) {
        alert("Detecte e selecione o certificado A3 instalado no computador (botão “Usar este”).");
        return;
      }
      if (estado.editando) {
        DB.update("certificados", estado.editando.id, d);
        estado.editando = null;
      } else {
        d.ativo = !lista().length;
        var novo = DB.insert("certificados", d);
        if (d.ativo) ativar(novo.id);
      }
      estado.arquivo = null;
      alert("Certificado " + d.tipo + " instalado. Use “Validar” para conferir junto à SEFAZ e à ICP-Brasil.");
    });

    UI.ligarCancelar(el, function () { estado.editando = null; estado.arquivo = null; Router.refresh(); });

    el.querySelector("#backup").addEventListener("click", function () {
      if (!todos.length) { alert("Nenhum certificado para backup."); return; }
      Fiscal.baixar("backup-certificados-" + Utils.hoje() + ".json",
        JSON.stringify({ gerado: new Date().toISOString(), certificados: todos }, null, 2),
        "application/json;charset=utf-8");
    });

    el.querySelector("#csv").addEventListener("click", function () {
      if (!todos.length) { alert("Nenhum certificado cadastrado."); return; }
      var cab = "Tipo;Titular;Documento;Validade;Ambiente;UF;Validacao;cStat;ValidadoEm";
      var linhas = todos.map(function (c) {
        var v = c.validacao || {};
        return [c.tipo, c.titular, c.documento, c.validade,
          c.ambiente === "1" ? "Producao" : "Homologacao", c.uf || "",
          v.situacao || "NAO VALIDADO", v.cStat || "", v.validadoEm || ""].join(";");
      });
      Fiscal.baixar("certificados-" + Utils.hoje() + ".csv",
        "\ufeff" + [cab].concat(linhas).join("\r\n"), "text/csv;charset=utf-8");
    });

    el.addEventListener("click", function (ev) {
      var t = ev.target;
      if (!t || !t.getAttribute) return;
      var usar = t.getAttribute("data-usar");
      var valdet = t.getAttribute("data-valdet");
      var selr = t.getAttribute("data-sel");
      var at = t.getAttribute("data-ativar"), ed = t.getAttribute("data-edit");
      var dl = t.getAttribute("data-baixar"), rm = t.getAttribute("data-del");
      var vd = t.getAttribute("data-validar");

      if (selr) { estado.deteccao.selecionado = selr; return; }

      if (usar) {
        var c = detectado(usar);
        if (!c) return;
        estado.deteccao.selecionado = usar;
        estado.editando = null;
        estado.tipo = c.tipo === "A1" && !c.hardware ? "A3" : "A3";
        estado.editando = {
          tipo: "A3", titular: c.titular, documento: c.documento, validade: c.validade,
          ambiente: "2", uf: ufPadrao(), thumbprint: c.thumbprint,
          repositorio: c.loja || c.origem, provedor: c.provedor,
          driver: (estado.deteccao.dados.drivers[0] || {}).caminho || ""
        };
        delete estado.editando.id;
        Router.refresh();
        return;
      }

      if (valdet) {
        var cd = detectado(valdet);
        if (!cd) return;
        validarRegistro({ thumbprint: cd.thumbprint, titular: cd.titular, uf: ufPadrao(), ambiente: "2" });
        return;
      }

      if (vd) {
        var reg = lista().filter(function (x) { return x.id === vd; })[0];
        if (reg) validarRegistro(reg);
        return;
      }

      if (at) ativar(at);
      if (ed) { estado.editando = lista().filter(function (c2) { return c2.id === ed; })[0]; Router.refresh(); }
      if (dl) {
        var cb = lista().filter(function (x) { return x.id === dl; })[0];
        if (cb) Fiscal.baixar(cb.arquivoNome || "certificado.pfx", paraBlob(cb.arquivoBase64));
      }
      if (rm && confirm("Remover este certificado do ERP? O certificado instalado no computador não é afetado.")) {
        DB.remove("certificados", rm);
      }
    });
  };
})(window);

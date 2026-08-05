/* Certificado Digital — instalação A1 (arquivo .pfx/.p12) e A3 (token/cartão) */
(function (w) {
  w.Modulos = w.Modulos || {};
  var estado = { tipo: "A1", arquivo: null, editando: null };

  function lista() { return DB.read("certificados"); }
  function ativo() {
    return lista().filter(function (c) { return c.ativo; })[0] || null;
  }
  function ativar(id) {
    DB.write("certificados", lista().map(function (c) {
      return Object.assign({}, c, { ativo: c.id === id });
    }));
  }
  function diasRestantes(c) {
    if (!c || !c.validade) return null;
    var ms = new Date(c.validade + "T23:59:59") - new Date();
    return Math.ceil(ms / 86400000);
  }
  function situacao(c) {
    var d = diasRestantes(c);
    if (d == null) return { texto: "Sem validade", tipo: "info" };
    if (d < 0) return { texto: "VENCIDO", tipo: "bad" };
    if (d <= 30) return { texto: "VENCE EM " + d + " DIAS", tipo: "warn" };
    return { texto: "VÁLIDO (" + d + " dias)", tipo: "ok" };
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

  w.Modulos.certificados = function (el) {
    var todos = lista();
    var atual = ativo();
    var e = estado.editando || {};
    var tipo = estado.editando ? (e.tipo || "A1") : estado.tipo;
    var a1 = tipo === "A1";
    var sit = atual ? situacao(atual) : null;

    var camposA1 =
      UI.campo("Arquivo do certificado (.pfx ou .p12)",
        '<input type="file" name="arquivo" id="arqCert" accept=".pfx,.p12,application/x-pkcs12" />') +
      UI.campo("Senha do certificado", UI.input("senha", { type: "password", value: e.senha, placeholder: "Senha do arquivo PFX" })) +
      UI.campo("Arquivo instalado", UI.input("arquivoNome", { value: e.arquivoNome, readonly: true, placeholder: "Nenhum arquivo selecionado" }));

    var camposA3 =
      UI.campo("Fabricante do token/cartão", UI.select("fabricante",
        ["Safenet / Aladdin", "Watchdata", "Gemalto", "Certisign", "Serasa", "Valid", "Outro"], e.fabricante)) +
      UI.campo("Biblioteca PKCS#11 (driver)", UI.input("driver", { value: e.driver, placeholder: "Ex.: C:\\Windows\\System32\\eTPKCS11.dll" })) +
      UI.campo("Slot / Leitora", UI.input("slot", { value: e.slot, placeholder: "0" })) +
      UI.campo("PIN (não é armazenado)", UI.input("pin", { type: "password", placeholder: "Solicitado a cada emissão" }));

    el.innerHTML = UI.pagina("Certificado Digital", "Instalação e gestão de certificados A1 e A3 para emissão de NF-e",
      '<div class="grid g4" style="margin-bottom:18px">' +
        UI.stat("Certificados instalados", todos.length, "c1") +
        UI.stat("Certificado ativo", UI.esc(atual ? atual.titular || "-" : "Nenhum"), atual ? "c2" : "c4") +
        UI.stat("Tipo", UI.esc(atual ? atual.tipo : "-"), "c5") +
        UI.stat("Situação", sit ? UI.badge(sit.texto, sit.tipo) : UI.badge("SEM CERTIFICADO", "bad"), sit && sit.tipo === "ok" ? "c2" : "c3") +
      "</div>" +

      '<div class="card"><h2>' + (estado.editando ? "Editar certificado" : "Instalar certificado") + "</h2>" +
      '<div class="row" style="margin-bottom:12px">' +
        '<button type="button" class="btn ' + (a1 ? "" : "ghost") + '" data-tipo="A1">A1 — arquivo (.pfx/.p12)</button>' +
        '<button type="button" class="btn ' + (a1 ? "ghost" : "") + '" data-tipo="A3">A3 — token / cartão</button>' +
      "</div>" +
      '<form id="frm"><div class="grid g2 linhas">' +
        UI.campo("Titular / Razão social", UI.input("titular", { value: e.titular })) +
        UI.campo("CNPJ/CPF do titular", UI.input("documento", { value: e.documento, mask: "documento" })) +
        UI.campo("Válido até", UI.input("validade", { type: "date", value: e.validade })) +
        UI.campo("Ambiente de uso", UI.select("ambiente", Fiscal.AMBIENTES, e.ambiente || "2")) +
        (a1 ? camposA1 : camposA3) +
      "</div>" +
      '<p class="hint" style="text-align:left;margin:10px 0 8px">' +
      (a1 ? "O arquivo é gravado com segurança apenas neste navegador (armazenamento local) e nunca é enviado para terceiros."
          : "No A3 a chave privada nunca sai do token. Registre aqui o driver e a leitora; o PIN é solicitado em cada emissão.") +
      "</p>" + UI.acoes(estado.editando, "Instalar certificado") + "</form></div>" +

      '<div class="card"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">Certificados instalados</h2>' +
      '<button class="btn ghost right" id="backup">Backup dos certificados</button></div>' +
      UI.tabela([
        { label: "Tipo", render: function (c) { return UI.badge(c.tipo, c.tipo === "A1" ? "info" : "warn"); } },
        { label: "Titular", chave: "titular" },
        { label: "CNPJ/CPF", render: function (c) { return Utils.mascaraDocumento(c.documento); } },
        { label: "Válido até", render: function (c) { return Utils.dataBR(c.validade); } },
        { label: "Situação", render: function (c) { var s = situacao(c); return UI.badge(s.texto, s.tipo); } },
        { label: "Ambiente", render: function (c) { return c.ambiente === "1" ? "Produção" : "Homologação"; } },
        { label: "Status", render: function (c) { return c.ativo ? UI.badge("ATIVO", "ok") : UI.badge("inativo", "info"); } },
        { label: "Ações", render: function (c) {
            return (c.ativo ? "" : '<button class="btn sm" data-ativar="' + c.id + '">Ativar</button> ') +
              (c.tipo === "A1" && c.arquivoBase64 ? '<button class="btn sm ghost" data-baixar="' + c.id + '">Baixar .pfx</button> ' : "") +
              '<button class="btn sm ghost" data-edit="' + c.id + '">Editar</button> ' +
              '<button class="btn sm danger" data-del="' + c.id + '">Remover</button>'; } }
      ], todos, "Nenhum certificado instalado. Instale um A1 ou A3 para emitir notas fiscais.") + "</div>");

    Array.prototype.forEach.call(el.querySelectorAll("[data-tipo]"), function (b) {
      b.addEventListener("click", function () {
        estado.tipo = b.getAttribute("data-tipo");
        estado.editando = null;
        estado.arquivo = null;
        Router.refresh();
      });
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

    el.querySelector("#frm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var d = UI.dados(ev.target);
      delete d.arquivo;
      delete d.pin;
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
      } else {
        if (!d.driver) { alert("Informe a biblioteca PKCS#11 (driver) do token A3."); return; }
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
      alert("Certificado " + d.tipo + " instalado com sucesso.");
    });

    UI.ligarCancelar(el, function () { estado.editando = null; estado.arquivo = null; Router.refresh(); });

    el.querySelector("#backup").addEventListener("click", function () {
      if (!todos.length) { alert("Nenhum certificado para backup."); return; }
      Fiscal.baixar("backup-certificados-" + Utils.hoje() + ".json",
        JSON.stringify({ gerado: new Date().toISOString(), certificados: todos }, null, 2),
        "application/json;charset=utf-8");
    });

    el.addEventListener("click", function (ev) {
      var t = ev.target;
      if (!t.getAttribute) return;
      var at = t.getAttribute("data-ativar"), ed = t.getAttribute("data-edit");
      var dl = t.getAttribute("data-baixar"), rm = t.getAttribute("data-del");
      if (at) ativar(at);
      if (ed) { estado.editando = lista().filter(function (c) { return c.id === ed; })[0]; Router.refresh(); }
      if (dl) {
        var c = lista().filter(function (x) { return x.id === dl; })[0];
        if (c) Fiscal.baixar(c.arquivoNome || "certificado.pfx", paraBlob(c.arquivoBase64));
      }
      if (rm && confirm("Remover este certificado do sistema?")) DB.remove("certificados", rm);
    });
  };

  w.Certificados = { ativo: ativo, situacao: situacao, diasRestantes: diasRestantes, lista: lista };
})(window);

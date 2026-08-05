/* Clientes (destinatários da NF-e) — cadastro fiscal completo.
   Coleção própria: "clientesnf". Os dados aqui alimentam o bloco <dest> do XML. */
(function (w) {
  w.Modulos = w.Modulos || {};
  var COL = "clientesnf";
  var estado = { editando: null, filtros: {} };

  var INDIE = [
    { valor: "1", label: "1 - Contribuinte de ICMS" },
    { valor: "2", label: "2 - Contribuinte isento de Inscrição" },
    { valor: "9", label: "9 - Não contribuinte" }
  ];
  var UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
    "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

  function lista() { return DB.read(COL); }
  /* Cliente apto a receber NF-e: documento válido + endereço + município IBGE */
  function pendencias(c) {
    var p = [];
    if (!Utils.soDigitos(c.documento)) p.push("CNPJ/CPF");
    if (!c.nome) p.push("nome");
    if (!c.endereco) p.push("endereço");
    if (!c.numero) p.push("número");
    if (!c.bairro) p.push("bairro");
    if (!c.cidade) p.push("cidade");
    if (!c.uf) p.push("UF");
    if (Utils.soDigitos(c.cep).length !== 8) p.push("CEP");
    if (Utils.soDigitos(c.codigoMunicipio).length !== 7) p.push("código IBGE do município");
    if (c.indIEDest === "1" && !Utils.soDigitos(c.ie)) p.push("Inscrição Estadual");
    return p;
  }
  function apto(c) { return pendencias(c).length === 0; }

  w.Modulos.clientes = function (el) {
    var todos = lista();
    var f = estado.filtros || {};
    var filtrados = todos.filter(function (c) {
      if (f.uf && String(c.uf || "").toUpperCase() !== f.uf) return false;
      if (f.situacao === "APTO" && !apto(c)) return false;
      if (f.situacao === "PENDENTE" && apto(c)) return false;
      if (f.busca && !Utils.contem([c.nome, c.fantasia, c.documento, c.email, c.cidade, c.ie].join(" "), f.busca)) return false;
      return true;
    });
    var e = estado.editando || {};
    var ufs = Object.keys(todos.reduce(function (a, c) { if (c.uf) a[String(c.uf).toUpperCase()] = 1; return a; }, {})).sort();

    el.innerHTML = UI.pagina("Clientes", "Destinatários da NF-e — cadastro com todos os dados fiscais exigidos pela SEFAZ",
      '<div class="grid g4" style="margin-bottom:18px">' +
        UI.stat("Clientes cadastrados", todos.length, "c1") +
        UI.stat("Aptos para NF-e", todos.filter(apto).length, "c2") +
        UI.stat("Com cadastro incompleto", todos.filter(function (c) { return !apto(c); }).length, "c4") +
        UI.stat("Contribuintes de ICMS", todos.filter(function (c) { return c.indIEDest === "1"; }).length, "c5") +
      "</div>" +

      UI.filtros(
        UI.campo("Buscar", UI.input("busca", { value: f.busca || "", placeholder: "Nome, CNPJ/CPF, cidade ou IE" })) +
        UI.campo("UF", UI.select("uf", [{ valor: "", label: "Todas" }]
          .concat(ufs.map(function (u) { return { valor: u, label: u }; })), f.uf || "")) +
        UI.campo("Situação fiscal", UI.select("situacao", [{ valor: "", label: "Todas" },
          { valor: "APTO", label: "Aptos para emissão" },
          { valor: "PENDENTE", label: "Cadastro incompleto" }], f.situacao || "")),
        '<div class="resumo">' +
          '<div><div class="k">Registros filtrados</div><div class="v">' + filtrados.length + "</div></div>" +
          '<div><div class="k">Total cadastrado</div><div class="v">' + todos.length + "</div></div>" +
        "</div>") +

      '<div class="card"><h2>' + (estado.editando ? "Editar cliente" : "Novo cliente") + "</h2>" +
      '<form id="frm"><div class="grid g2 linhas">' +
        UI.campo("Tipo de pessoa", UI.select("tipoPessoa", [
          { valor: "J", label: "Pessoa jurídica (CNPJ)" },
          { valor: "F", label: "Pessoa física (CPF)" }], e.tipoPessoa || "J")) +
        UI.campo("CNPJ/CPF", UI.input("documento", { value: e.documento, mask: "documento", id: "campoDoc", placeholder: "00.000.000/0000-00" })) +
        UI.campo("Nome / Razão social", UI.input("nome", { value: e.nome })) +
        UI.campo("Nome fantasia", UI.input("fantasia", { value: e.fantasia, placeholder: "Opcional" })) +
        UI.campo("Indicador de IE do destinatário", UI.select("indIEDest", INDIE, e.indIEDest || "9")) +
        UI.campo("Inscrição Estadual", UI.input("ie", { value: e.ie, placeholder: "Somente números / ISENTO" })) +
        UI.campo("Inscrição Municipal", UI.input("im", { value: e.im, placeholder: "Opcional (serviços)" })) +
        UI.campo("Suframa", UI.input("suframa", { value: e.suframa, placeholder: "Opcional (Zona Franca)" })) +
        UI.campo("CEP", UI.input("cep", { value: e.cep, mask: "cep", id: "campoCep", maxlength: 9, placeholder: "00000-000" })) +
        UI.campo("Endereço (rua)", UI.input("endereco", { value: e.endereco })) +
        UI.campo("Número", UI.input("numero", { value: e.numero, placeholder: "SN" })) +
        UI.campo("Complemento", UI.input("complemento", { value: e.complemento, placeholder: "Opcional" })) +
        UI.campo("Bairro", UI.input("bairro", { value: e.bairro })) +
        UI.campo("Cidade", UI.input("cidade", { value: e.cidade })) +
        UI.campo("UF", UI.select("uf", [{ valor: "", label: "Selecione..." }]
          .concat(UFS.map(function (u) { return { valor: u, label: u }; })), e.uf || "")) +
        UI.campo("Código do município (IBGE)", UI.input("codigoMunicipio", { value: e.codigoMunicipio, id: "campoIbge", maxlength: 7, placeholder: "Preenchido pelo CEP" })) +
        UI.campo("Telefone", UI.input("telefone", { value: e.telefone, mask: "telefone", placeholder: "(00) 00000-0000" })) +
        UI.campo("E-mail (envio do XML/DANFE)", UI.input("email", { type: "email", value: e.email })) +
        UI.campo("Consumidor final", UI.select("consumidorFinal", [
          { valor: "1", label: "1 - Consumidor final" },
          { valor: "0", label: "0 - Normal (revenda)" }], e.consumidorFinal || "1")) +
        UI.campo("Observação para a nota", UI.input("observacao", { value: e.observacao, placeholder: "Opcional — vai nas informações complementares" })) +
      "</div>" +
      '<p class="hint" style="text-align:left;margin:10px 0 8px">Digite o CNPJ para buscar a razão social e o endereço automaticamente; ' +
      "o CEP preenche rua, bairro, cidade, UF e o código IBGE do município (obrigatório no XML da NF-e).</p>" +
      '<p class="erro" id="msgErro" style="text-align:left" hidden></p>' +
      '<p class="aviso" id="msgAviso" hidden></p>' +
      UI.acoes(estado.editando) + "</form></div>" +

      '<div class="card"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">Clientes</h2>' +
      '<button class="btn ghost right" id="exp">Exportar Excel</button></div>' +
      UI.tabela([
        { label: "Nome / Razão social", render: function (c) { return UI.esc(c.nome) + (c.fantasia ? '<br /><span style="font-size:11px;color:var(--muted)">' + UI.esc(c.fantasia) + "</span>" : ""); } },
        { label: "CNPJ/CPF", render: function (c) { return UI.esc(Utils.mascaraDocumento(c.documento)); } },
        { label: "IE", render: function (c) { return UI.esc(c.ie || (c.indIEDest === "9" ? "não contrib." : "ISENTO")); } },
        { label: "Cidade/UF", render: function (c) { return UI.esc([c.cidade, c.uf].filter(Boolean).join("/")); } },
        { label: "IBGE", chave: "codigoMunicipio" },
        { label: "Telefone", render: function (c) { return UI.esc(Utils.mascaraTelefone(c.telefone)); } },
        { label: "NF-e", render: function (c) {
            var p = pendencias(c);
            return p.length ? UI.badge("FALTA: " + p.slice(0, 2).join(", "), "warn") : UI.badge("APTO", "ok"); } },
        { label: "Ações", render: function (c) {
            return '<button class="btn sm ghost" data-edit="' + c.id + '">Editar</button> ' +
              '<button class="btn sm" data-nota="' + c.id + '">Emitir NF-e</button> ' +
              '<button class="btn sm danger" data-del="' + c.id + '">Excluir</button>'; } }
      ], filtrados, "Nenhum cliente cadastrado. Cadastre o destinatário antes de emitir a nota fiscal.") + "</div>");

    UI.ligarFiltros(el, estado, function () { Router.refresh(); });

    var form = el.querySelector("#frm");
    var msgErro = el.querySelector("#msgErro");
    var msgAviso = el.querySelector("#msgAviso");
    function erro(t) { msgErro.textContent = t || ""; msgErro.hidden = !t; }
    function aviso(t) { msgAviso.textContent = t || ""; msgAviso.hidden = !t; }

    function duplicado(doc, ignoraId) {
      var d = Utils.soDigitos(doc);
      if (!d) return null;
      return lista().filter(function (c) {
        return c.id !== ignoraId && Utils.soDigitos(c.documento) === d;
      })[0] || null;
    }

    /* ---- CEP: endereço + código IBGE automáticos ---- */
    var campoCep = form.elements["cep"];
    var ultimoCep = "";
    function buscarCEP() {
      var d = Utils.soDigitos(campoCep.value);
      if (d.length !== 8 || d === ultimoCep) return;
      ultimoCep = d;
      erro(""); aviso("Buscando endereço do CEP...");
      Utils.consultarCEP(d).then(function (a) {
        if (!form.isConnected) return;
        if (a.endereco) form.elements["endereco"].value = a.endereco;
        if (a.bairro) form.elements["bairro"].value = a.bairro;
        if (a.cidade) form.elements["cidade"].value = a.cidade;
        if (a.uf) form.elements["uf"].value = a.uf;
        if (a.ibge) form.elements["codigoMunicipio"].value = Utils.soDigitos(a.ibge).slice(0, 7);
        aviso("Endereço encontrado: " + [a.endereco, a.bairro, a.cidade + "/" + a.uf].filter(Boolean).join(", ") +
          (a.ibge ? " — IBGE " + a.ibge : " — informe o código IBGE do município"));
        form.elements["numero"].focus();
      }).catch(function () {
        if (!form.isConnected) return;
        aviso(""); erro("CEP não encontrado. Preencha o endereço manualmente.");
      });
    }
    campoCep.addEventListener("blur", buscarCEP);
    campoCep.addEventListener("input", function () {
      if (Utils.soDigitos(campoCep.value).length === 8) buscarCEP();
    });

    /* ---- CNPJ: razão social, telefone e endereço automáticos ---- */
    var campoDoc = form.elements["documento"];
    var ultimoDoc = "";
    function buscarCNPJ() {
      var d = Utils.soDigitos(campoDoc.value);
      if (d.length !== 14 || d === ultimoDoc) return;
      ultimoDoc = d;
      var dup = duplicado(d, estado.editando && estado.editando.id);
      if (dup) { aviso(""); erro("Este CNPJ já está cadastrado para: " + dup.nome + "."); return; }
      if (!Utils.validarCNPJ(d)) { aviso(""); erro("CNPJ inválido."); return; }
      erro(""); aviso("Buscando dados do CNPJ...");
      Utils.consultarCNPJ(d).then(function (dados) {
        if (!form.isConnected) return;
        function pre(campo, valor) { if (valor && form.elements[campo] && !form.elements[campo].value) form.elements[campo].value = valor; }
        pre("nome", dados.razaoSocial || dados.nome);
        pre("fantasia", dados.nome);
        pre("telefone", dados.telefone);
        pre("email", dados.email);
        pre("cidade", dados.cidade);
        pre("uf", dados.uf);
        pre("endereco", dados.endereco);
        aviso("Dados encontrados: " + (dados.razaoSocial || dados.nome) + ". Informe o CEP para completar o endereço e o código IBGE.");
      }).catch(function () {
        if (!form.isConnected) return;
        aviso("Não foi possível consultar este CNPJ. Preencha os dados manualmente.");
      });
    }
    campoDoc.addEventListener("blur", buscarCNPJ);
    campoDoc.addEventListener("input", function () {
      if (Utils.soDigitos(campoDoc.value).length === 14) buscarCNPJ();
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var d = UI.dados(ev.target);
      d.nome = (d.nome || "").trim();
      d.uf = String(d.uf || "").toUpperCase();
      d.codigoMunicipio = Utils.soDigitos(d.codigoMunicipio);
      erro(""); aviso("");
      if (!d.nome) return erro("Informe o nome / razão social.");
      if (!Utils.soDigitos(d.documento)) return erro("Informe o CNPJ/CPF do cliente.");
      if (!Utils.validarDocumento(d.documento)) return erro("CNPJ/CPF inválido.");
      var dup = duplicado(d.documento, estado.editando && estado.editando.id);
      if (dup) return erro('Cadastro em duplicidade: "' + dup.nome + '" já usa este CNPJ/CPF.');
      if (!d.uf) return erro("Selecione a UF do cliente.");
      if (d.indIEDest === "1" && !Utils.soDigitos(d.ie)) return erro("Contribuinte de ICMS exige Inscrição Estadual.");

      if (estado.editando) {
        DB.update(COL, estado.editando.id, d);
        estado.editando = null;
      } else {
        DB.insert(COL, d);
        UI.limparForm(ev.target);
      }
      var falta = pendencias(d);
      aviso(falta.length
        ? "Cliente salvo. Para emitir NF-e ainda falta: " + falta.join(", ") + "."
        : "Cliente salvo e apto para emissão de NF-e.");
      Router.refresh();
    });

    UI.ligarCancelar(el, function () { estado.editando = null; Router.refresh(); });

    el.querySelector("#exp").addEventListener("click", function () {
      Utils.exportarCSV("clientes", [
        { label: "Nome", chave: "nome" }, { label: "Fantasia", chave: "fantasia" },
        { label: "CNPJ/CPF", valor: function (c) { return Utils.mascaraDocumento(c.documento); } },
        { label: "IE", chave: "ie" }, { label: "CEP", chave: "cep" },
        { label: "Endereço", valor: function (c) { return [c.endereco, c.numero, c.bairro].filter(Boolean).join(", "); } },
        { label: "Cidade", chave: "cidade" }, { label: "UF", chave: "uf" },
        { label: "IBGE", chave: "codigoMunicipio" },
        { label: "Telefone", chave: "telefone" }, { label: "E-mail", chave: "email" },
        { label: "Apto NF-e", valor: function (c) { return apto(c) ? "SIM" : "NAO"; } }
      ], filtrados);
    });

    el.addEventListener("click", function (ev) {
      var t = ev.target;
      if (!t.getAttribute) return;
      var ed = t.getAttribute("data-edit"), rm = t.getAttribute("data-del"), nf = t.getAttribute("data-nota");
      if (ed) { estado.editando = lista().filter(function (c) { return c.id === ed; })[0]; Router.refresh(); }
      if (rm && confirm("Excluir este cliente?")) DB.remove(COL, rm);
      if (nf) {
        var c = lista().filter(function (x) { return x.id === nf; })[0];
        var falta = c ? pendencias(c) : ["cadastro"];
        if (falta.length) { alert("Complete o cadastro antes de emitir: " + falta.join(", ") + "."); return; }
        if (w.Notas && Notas.emitirPara) Notas.emitirPara(c.id);
        location.hash = "#/notas";
      }
    });
  };

  w.Clientes = { COL: COL, lista: lista, apto: apto, pendencias: pendencias };
})(window);

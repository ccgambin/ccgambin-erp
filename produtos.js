/* Cadastro de produtos — fornecedor buscado automaticamente do cadastro */
(function (w) {
  w.Modulos = w.Modulos || {};
  var estado = { busca: "", categoria: "", editando: null };

  w.Modulos.produtos = function (el) {
    var todos = DB.read("produtos");
    var fornecedores = DB.read("fornecedores");
    var lista = todos.filter(function (p) {
      var t = (p.codigo + " " + p.descricao + " " + (p.fornecedor || "")).toLowerCase();
      return (!estado.busca || t.indexOf(estado.busca.toLowerCase()) >= 0) &&
        (!estado.categoria || p.categoria === estado.categoria);
    });
    var e = estado.editando || {};

    /* Fornecedor: lista suspensa alimentada pelo módulo de Fornecedores */
    var opcoesForn = [{ valor: "", label: fornecedores.length ? "Selecione o fornecedor..." : "Nenhum fornecedor cadastrado" }]
      .concat(fornecedores.map(function (f) { return { valor: f.id, label: f.nome }; }));
    var fornAtualId = e.fornecedorId ||
      (fornecedores.filter(function (f) { return f.nome === e.fornecedor; })[0] || {}).id || "";

    el.innerHTML = UI.pagina("Produtos", "Cadastro e manutenção do catálogo",
      '<div class="grid g4" style="margin-bottom:18px">' +
        UI.stat("Produtos cadastrados", todos.length, "c1") +
        UI.stat("Fornecedores", fornecedores.length, "c5") +
        UI.stat("Valor em custo", Utils.moeda(Domain.valorEstoque()), "c2") +
        UI.stat("Estoque baixo", Domain.estoqueBaixo().length, "c4") +
      "</div>" +
      '<div class="card"><h2>' + (estado.editando ? "Editar produto" : "Novo produto") + '</h2>' +
      '<form id="frm"><div class="grid g2 linhas">' +
        UI.campo("Código", UI.input("codigo", { value: e.codigo })) +
        UI.campo("Descrição", UI.input("descricao", { value: e.descricao })) +
        UI.campo("Categoria", UI.select("categoria", Domain.CATEGORIAS, e.categoria)) +
        UI.campo("Fornecedor (cadastrado)", UI.select("fornecedorId", opcoesForn, fornAtualId).replace('name="fornecedorId"', 'name="fornecedorId" id="selForn"')) +
        UI.campo("Fornecedor (nome)", UI.input("fornecedor", { value: e.fornecedor, id: "nomeForn", readonly: true, placeholder: "Preenchido automaticamente" })) +
        UI.campo("CNPJ do fornecedor", UI.input("fornecedorDoc", { value: e.fornecedorDoc, id: "docForn", readonly: true, placeholder: "Preenchido automaticamente" })) +
        UI.campo("Cidade do fornecedor", UI.input("fornecedorCidade", { value: e.fornecedorCidade, id: "cidForn", readonly: true, placeholder: "Preenchido automaticamente" })) +
        UI.campo("Unidade", UI.select("unidade", Domain.UNIDADES, e.unidade)) +
        UI.campo("Custo (R$)", UI.moeda("custo", e.custo)) +
        UI.campo("Venda (R$)", UI.moeda("venda", e.venda)) +
        UI.campo("Estoque", UI.input("estoque", { type: "number", step: "0.01", value: e.estoque })) +
        UI.campo("Estoque mínimo", UI.input("minimo", { type: "number", step: "0.01", value: e.minimo })) +
      '</div>' +
      '<h2 style="margin-top:18px">Dados fiscais (usados na emissão da NF-e)</h2>' +
      '<div class="grid g4 linhas">' +
        UI.campo("NCM", UI.input("ncm", { value: e.ncm, maxlength: 8, placeholder: "00000000" })) +
        UI.campo("CEST", UI.input("cest", { value: e.cest, maxlength: 7, placeholder: "Opcional (ST)" })) +
        UI.campo("GTIN/EAN", UI.input("gtin", { value: e.gtin, placeholder: "SEM GTIN" })) +
        UI.campo("Origem da mercadoria", UI.select("origem", [
          { valor: "0", label: "0 - Nacional" }, { valor: "1", label: "1 - Importação direta" },
          { valor: "2", label: "2 - Adquirida no mercado interno" },
          { valor: "3", label: "3 - Nacional > 40% importado" },
          { valor: "8", label: "8 - Nacional, importação < 40%" }], e.origem || "0")) +
        UI.campo("CFOP dentro do estado", UI.input("cfop", { value: e.cfop || "5102", maxlength: 4 })) +
        UI.campo("CFOP fora do estado", UI.input("cfopFora", { value: e.cfopFora || "6102", maxlength: 4 })) +
        UI.campo("CSOSN / CST ICMS", UI.select("csosn", ["102", "101", "103", "300", "400", "500", "900"], e.csosn || "102")) +
        UI.campo("Alíquota ICMS (%)", UI.input("aliqIcms", { type: "number", step: "0.01", value: e.aliqIcms || "0" })) +
        UI.campo("CST PIS", UI.select("cstPis", ["07", "01", "04", "06", "49"], e.cstPis || "07")) +
        UI.campo("Alíquota PIS (%)", UI.input("aliqPis", { type: "number", step: "0.01", value: e.aliqPis || "0" })) +
        UI.campo("CST COFINS", UI.select("cstCofins", ["07", "01", "04", "06", "49"], e.cstCofins || "07")) +
        UI.campo("Alíquota COFINS (%)", UI.input("aliqCofins", { type: "number", step: "0.01", value: e.aliqCofins || "0" })) +
      '</div>' +
      '<p class="hint" style="text-align:left;margin:10px 0 8px">Os dados fiscais são gravados junto com o produto: ao emitir uma nota, NCM, CFOP, CSOSN, origem, CEST e alíquotas são preenchidos automaticamente.</p>' +
      '<p class="hint" style="text-align:left;margin:10px 0 8px">Selecione o fornecedor: nome, CNPJ e cidade são buscados automaticamente do cadastro de Fornecedores.</p>' +
      UI.acoes(estado.editando) + "</form></div>" +
      '<div class="card"><div class="row" style="margin-bottom:12px">' +
      '<input id="busca" placeholder="Buscar produto..." style="max-width:260px" value="' + UI.esc(estado.busca) + '" />' +
      UI.select("filtroCat", [{ valor: "", label: "Todas as categorias" }].concat(Domain.CATEGORIAS), estado.categoria).replace('name="filtroCat"', 'id="filtroCat" style="max-width:200px"') +
      '<button class="btn ghost right" id="exportar">Exportar Excel</button></div>' +
      UI.tabela([
        { label: "Código", chave: "codigo" },
        { label: "Descrição", chave: "descricao" },
        { label: "Categoria", chave: "categoria" },
        { label: "NCM", render: function (p) { return p.ncm ? UI.esc(p.ncm) : UI.badge("SEM NCM", "warn"); } },
        { label: "CFOP", chave: "cfop" },
        { label: "Fornecedor", chave: "fornecedor" },
        { label: "Un", chave: "unidade" },
        { label: "Custo", render: function (p) { return Utils.moeda(p.custo); } },
        { label: "Venda", render: function (p) { return Utils.moeda(p.venda); } },
        { label: "Estoque", render: function (p) {
            return Utils.numero(p.estoque) + " " + UI.badge(Utils.numero(p.estoque) <= Utils.numero(p.minimo) ? "BAIXO" : "OK",
              Utils.numero(p.estoque) <= Utils.numero(p.minimo) ? "bad" : "ok"); } },
        { label: "Ações", render: function (p) {
            return '<button class="btn sm ghost" data-edit="' + p.id + '">Editar</button> ' +
                   '<button class="btn sm danger" data-del="' + p.id + '">Excluir</button>'; } }
      ], lista) + "</div>");

    var selForn = el.querySelector("#selForn");
    function preencherFornecedor() {
      var f = fornecedores.filter(function (x) { return x.id === selForn.value; })[0];
      el.querySelector("#nomeForn").value = f ? f.nome : "";
      el.querySelector("#docForn").value = f ? Utils.mascaraDocumento(f.documento) : "";
      el.querySelector("#cidForn").value = f ? (f.cidade || "") : "";
    }
    selForn.addEventListener("change", preencherFornecedor);
    if (selForn.value && !el.querySelector("#nomeForn").value) preencherFornecedor();

    el.querySelector("#frm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var d = UI.dados(ev.target);
      ["custo", "venda", "estoque", "minimo"].forEach(function (k) { d[k] = Utils.numero(d[k]); });
      if (!d.codigo || !d.descricao) { alert("Informe código e descrição do produto."); return; }
      if (!d.fornecedorId) { alert("Selecione o fornecedor. Cadastre-o antes no módulo Fornecedores."); return; }
      d.ncm = Utils.soDigitos(d.ncm);
      d.cest = Utils.soDigitos(d.cest);
      if (d.ncm.length !== 8) { alert("Informe o NCM do produto com 8 dígitos (obrigatório para emitir a NF-e)."); return; }
      if (Utils.soDigitos(d.cfop).length !== 4) { alert("Informe o CFOP dentro do estado (4 dígitos)."); return; }
      ["aliqIcms", "aliqPis", "aliqCofins"].forEach(function (k) { d[k] = Utils.numero(d[k]); });
      d.status = "ATIVO";
      if (estado.editando) { DB.update("produtos", estado.editando.id, d); estado.editando = null; }
      else DB.insert("produtos", d);
    });

    UI.ligarCancelar(el, function () { estado.editando = null; Router.refresh(); });

    el.querySelector("#busca").addEventListener("input", function (ev) { estado.busca = ev.target.value; UI.resetarPaginas(); Router.refresh(); ev.target.focus(); });
    el.querySelector("#filtroCat").addEventListener("change", function (ev) { estado.categoria = ev.target.value; UI.resetarPaginas(); Router.refresh(); });
    el.querySelector("#exportar").addEventListener("click", function () {
      Utils.exportarCSV("produtos", [
        { label: "Código", chave: "codigo" }, { label: "Descrição", chave: "descricao" },
        { label: "Categoria", chave: "categoria" }, { label: "Fornecedor", chave: "fornecedor" },
        { label: "Unidade", chave: "unidade" },
        { label: "Custo", valor: function (p) { return Utils.moeda(p.custo); } },
        { label: "Venda", valor: function (p) { return Utils.moeda(p.venda); } },
        { label: "Estoque", chave: "estoque" }, { label: "Mínimo", chave: "minimo" },
        { label: "NCM", chave: "ncm" }, { label: "CFOP", chave: "cfop" },
        { label: "CSOSN", chave: "csosn" }, { label: "Origem", chave: "origem" }
      ], lista);
    });
    el.addEventListener("click", function (ev) {
      var edit = ev.target.getAttribute && ev.target.getAttribute("data-edit");
      var del = ev.target.getAttribute && ev.target.getAttribute("data-del");
      if (edit) { estado.editando = DB.read("produtos").filter(function (p) { return p.id === edit; })[0]; Router.refresh(); }
      if (del && confirm("Excluir este produto?")) DB.remove("produtos", del);
    });
  };
})(window);

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
        { label: "Estoque", chave: "estoque" }, { label: "Mínimo", chave: "minimo" }
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

/* Dashboard: visão geral do negócio com cards coloridos */
(function (w) {
  w.Modulos = w.Modulos || {};
  w.Modulos.dashboard = function (el) {
    var produtos = DB.read("produtos"), vendedores = DB.read("clientes");
    var vendas = DB.read("vendas"), compras = DB.read("compras");
    var baixo = Domain.estoqueBaixo();
    var totalVendas = vendas.reduce(function (t, v) { return t + Utils.numero(v.total); }, 0);
    var totalCompras = compras.reduce(function (t, v) { return t + Utils.numero(v.total); }, 0);
    var comissoes = Domain.totalComissoes();
    var st = Cloud.estado();

    el.innerHTML = UI.pagina("Dashboard", "Visão geral do sistema",
      '<div class="grid g4" style="margin-bottom:18px">' +
        UI.stat("Produtos", produtos.length, "c1") +
        UI.stat("Vendedores(a)", vendedores.length, "c5") +
        UI.stat("Valor em estoque", Utils.moeda(Domain.valorEstoque()), "c2") +
        UI.stat("Saldo em caixa", Utils.moeda(Domain.saldoCaixa()), "c6") +
      "</div>" +
      '<div class="grid g4" style="margin-bottom:18px">' +
        UI.stat("Total vendido", Utils.moeda(totalVendas), "c2") +
        UI.stat("Total comprado", Utils.moeda(totalCompras), "c3") +
        UI.stat("Comissões das vendedoras", Utils.moeda(comissoes), "c5") +
        UI.stat("Estoque baixo", baixo.length, "c4") +
      "</div>" +
      '<div class="grid g4" style="margin-bottom:18px">' +
        UI.stat("Contas a pagar em aberto", DB.read("contaspagar").filter(function (c) { return c.status === "ABERTO"; }).length, "c4") +
        UI.stat("Contas a receber em aberto", DB.read("contasreceber").filter(function (c) { return c.status === "ABERTO"; }).length, "c2") +
        UI.stat("Movimentos de estoque", DB.read("movimentos").length, "c1") +
        UI.stat("Nuvem Firebase", '<span class="cloud ' + (st.status === "conectado" ? "on" : (st.status === "erro" ? "off" : "")) + '">' +
          (st.status === "conectado" ? "Sincronizado" : st.status === "erro" ? "Erro" : "Local") + "</span>", "c6") +
      "</div>" +
      '<div class="card"><h2>Comissões por vendedor(a)</h2>' +
      UI.tabela([
        { label: "Vendedor(a)", chave: "vendedor" },
        { label: "Vendas", chave: "vendas" },
        { label: "Total vendido", render: function (r) { return Utils.moeda(r.total); } },
        { label: "Comissão", render: function (r) { return Utils.moeda(r.comissao); } }
      ], Domain.comissoesPorVendedor(), "Nenhuma venda registrada.") + "</div>" +
      '<div class="card"><h2>Alertas de estoque baixo</h2>' +
      UI.tabela([
        { label: "Código", chave: "codigo" },
        { label: "Produto", chave: "descricao" },
        { label: "Fornecedor", chave: "fornecedor" },
        { label: "Estoque", render: function (p) { return Utils.numero(p.estoque) + " " + UI.esc(p.unidade || ""); } },
        { label: "Mínimo", chave: "minimo" },
        { label: "Situação", render: function () { return UI.badge("REPOR", "bad"); } }
      ], baixo, "Nenhum produto abaixo do mínimo.") + "</div>");
  };
})(window);

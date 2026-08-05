/* Relatórios gerenciais */
(function (w) {
  w.Modulos = w.Modulos || {};
  w.Modulos.relatorios = function (el) {
    var produtos = DB.read("produtos"), vendas = DB.read("vendas");
    var porCategoria = Domain.CATEGORIAS.map(function (cat) {
      var itens = produtos.filter(function (p) { return p.categoria === cat; });
      return {
        categoria: cat, itens: itens.length,
        unidades: itens.reduce(function (t, p) { return t + Utils.numero(p.estoque); }, 0),
        valor: itens.reduce(function (t, p) { return t + Utils.numero(p.custo) * Utils.numero(p.estoque); }, 0)
      };
    });
    var comissoes = Domain.comissoesPorVendedor();
    var ranking = {};
    vendas.forEach(function (v) {
      var k = v.produtoId;
      ranking[k] = ranking[k] || { produto: Domain.nomeProduto(k), qtd: 0, total: 0 };
      ranking[k].qtd += Utils.numero(v.quantidade);
      ranking[k].total += Utils.numero(v.total);
    });
    var maisVendidos = Object.keys(ranking).map(function (k) { return ranking[k]; })
      .sort(function (a, b) { return b.total - a.total; });
    el.innerHTML = UI.pagina("Relatórios", "Análises gerenciais do negócio",
      '<div class="card"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">Estoque por categoria</h2>' +
      '<button class="btn ghost right" id="expCat">Exportar Excel</button></div>' +
      UI.tabela([
        { label: "Categoria", chave: "categoria" }, { label: "Itens", chave: "itens" },
        { label: "Unidades", chave: "unidades" },
        { label: "Valor de custo", render: function (r) { return Utils.moeda(r.valor); } }
      ], porCategoria) + "</div>" +
      '<div class="card"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">Produtos mais vendidos</h2>' +
      '<button class="btn ghost right" id="expVen">Exportar Excel</button></div>' +
      UI.tabela([
        { label: "Produto", chave: "produto" }, { label: "Quantidade", chave: "qtd" },
        { label: "Faturamento", render: function (r) { return Utils.moeda(r.total); } }
      ], maisVendidos, "Nenhuma venda registrada.") + "</div>" +
      '<div class="card"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">Comissões por vendedor(a)</h2>' +
      '<button class="btn ghost right" id="expCom">Exportar Excel</button></div>' +
      UI.tabela([
        { label: "Vendedor(a)", chave: "vendedor" },
        { label: "Vendas", chave: "vendas" },
        { label: "Total vendido", render: function (r) { return Utils.moeda(r.total); } },
        { label: "Comissão paga/prevista", render: function (r) { return Utils.moeda(r.comissao); } }
      ], comissoes, "Nenhuma venda registrada.") + "</div>" +
      '<div class="card"><h2>Resumo financeiro</h2><div class="grid g4">' +
        UI.stat("Saldo em caixa", Utils.moeda(Domain.saldoCaixa()), "c1") +
        UI.stat("A receber", Utils.moeda(DB.read("contasreceber").filter(function (c) { return c.status === "ABERTO"; }).reduce(function (t, c) { return t + Utils.numero(c.valor); }, 0)), "c2") +
        UI.stat("A pagar", Utils.moeda(DB.read("contaspagar").filter(function (c) { return c.status === "ABERTO"; }).reduce(function (t, c) { return t + Utils.numero(c.valor); }, 0)), "c4") +
        UI.stat("Valor em estoque", Utils.moeda(Domain.valorEstoque()), "c3") +
      "</div></div>");
    el.querySelector("#expCom").addEventListener("click", function () {
      Utils.exportarCSV("comissoes-por-vendedor", [
        { label: "Vendedor(a)", chave: "vendedor" }, { label: "Vendas", chave: "vendas" },
        { label: "Total vendido", valor: function (r) { return Utils.moeda(r.total); } },
        { label: "Comissão", valor: function (r) { return Utils.moeda(r.comissao); } }
      ], comissoes);
    });
    el.querySelector("#expCat").addEventListener("click", function () {
      Utils.exportarCSV("estoque-por-categoria", [
        { label: "Categoria", chave: "categoria" }, { label: "Itens", chave: "itens" },
        { label: "Unidades", chave: "unidades" }, { label: "Valor", chave: "valor" }
      ], porCategoria);
    });
    el.querySelector("#expVen").addEventListener("click", function () {
      Utils.exportarCSV("mais-vendidos", [
        { label: "Produto", chave: "produto" }, { label: "Quantidade", chave: "qtd" }, { label: "Faturamento", chave: "total" }
      ], maisVendidos);
    });
  };
})(window);

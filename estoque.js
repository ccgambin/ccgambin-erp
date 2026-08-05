/* Posição de estoque e valorização */
(function (w) {
  w.Modulos = w.Modulos || {};
  var estado = { filtros: {} };
  w.Modulos.estoque = function (el) {
    var f = estado.filtros || {};
    var todos = DB.read("produtos");
    /* Filtros: busca, categoria e situação do estoque */
    var produtos = todos.filter(function (p) {
      var repor = Utils.numero(p.estoque) <= Utils.numero(p.minimo);
      if (f.categoria && p.categoria !== f.categoria) return false;
      if (f.situacao === "REPOR" && !repor) return false;
      if (f.situacao === "NORMAL" && repor) return false;
      if (f.situacao === "ZERADO" && Utils.numero(p.estoque) > 0) return false;
      if (f.busca && !Utils.contem([p.codigo, p.descricao, p.fornecedor].join(" "), f.busca)) return false;
      return true;
    });
    el.innerHTML = UI.pagina("Estoque", "Posição atual e valorização do inventário",
      '<div class="grid g4" style="margin-bottom:18px">' +
        UI.stat("Itens cadastrados", todos.length, "c1") +
        UI.stat("Unidades em estoque", produtos.reduce(function (t, p) { return t + Utils.numero(p.estoque); }, 0), "c6") +
        UI.stat("Valor de custo", Utils.moeda(Domain.valorEstoque()), "c3") +
        UI.stat("Valor de venda", Utils.moeda(produtos.reduce(function (t, p) { return t + Utils.numero(p.venda) * Utils.numero(p.estoque); }, 0)), "c2") +
      "</div>" +
      UI.filtros(
        UI.campo("Buscar produto", UI.input("busca", { value: f.busca || "", placeholder: "Código, descrição ou fornecedor" })) +
        UI.campo("Categoria", UI.select("categoria", [{ valor: "", label: "Todas as categorias" }].concat(Domain.CATEGORIAS), f.categoria || "")) +
        UI.campo("Situação", UI.select("situacao", [
          { valor: "", label: "Todas" }, { valor: "REPOR", label: "Abaixo do mínimo" },
          { valor: "NORMAL", label: "Estoque normal" }, { valor: "ZERADO", label: "Sem estoque" }], f.situacao || "")) +
        UI.campo("", '<span class="hint" style="text-align:left;display:block;margin:0">Itens sem estoque bloqueiam novas vendas.</span>'),
        '<div class="resumo">' +
          '<div><div class="k">Itens filtrados</div><div class="v">' + produtos.length + "</div></div>" +
          '<div><div class="k">Unidades</div><div class="v">' + produtos.reduce(function (t, p) { return t + Utils.numero(p.estoque); }, 0) + "</div></div>" +
          '<div class="destaque"><div class="k">Custo filtrado</div><div class="v">' +
            Utils.moeda(produtos.reduce(function (t, p) { return t + Utils.numero(p.custo) * Utils.numero(p.estoque); }, 0)) + "</div></div>" +
        "</div>") +
      '<div class="card"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">Produtos</h2>' +
      '<button class="btn ghost right" id="exp">Exportar Excel</button></div>' +
      UI.tabela([
        { label: "Código", chave: "codigo" },
        { label: "Produto", chave: "descricao" },
        { label: "Categoria", chave: "categoria" },
        { label: "Estoque", chave: "estoque" },
        { label: "Mínimo", chave: "minimo" },
        { label: "Custo total", render: function (p) { return Utils.moeda(Utils.numero(p.custo) * Utils.numero(p.estoque)); } },
        { label: "Situação", render: function (p) {
            return Utils.numero(p.estoque) <= Utils.numero(p.minimo) ? UI.badge("REPOR", "bad") : UI.badge("NORMAL", "ok"); } }
      ], produtos, "Nenhum produto encontrado para os filtros aplicados.") + "</div>");
    UI.ligarFiltros(el, estado, function () { Router.refresh(); });
    el.querySelector("#exp").addEventListener("click", function () {
      Utils.exportarCSV("estoque", [
        { label: "Código", chave: "codigo" }, { label: "Produto", chave: "descricao" },
        { label: "Estoque", chave: "estoque" }, { label: "Mínimo", chave: "minimo" },
        { label: "Custo total", valor: function (p) { return (Utils.numero(p.custo) * Utils.numero(p.estoque)).toFixed(2); } }
      ], produtos);
    });
  };
})(window);

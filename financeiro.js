/* Fluxo de caixa — com edição, cancelamento e valores em R$ */
(function (w) {
  w.Modulos = w.Modulos || {};
  var estado = { editando: null, filtros: {} };
  w.Modulos.financeiro = function (el) {
    var f = estado.filtros || {};
    /* Filtros: período, tipo, origem e busca livre */
    var lancamentos = DB.read("caixa").slice().reverse().filter(function (l) {
      if (!Utils.entreDatas(l.data, f.de, f.ate)) return false;
      if (f.tipo && l.tipo !== f.tipo) return false;
      if (f.origem && String(l.origem || "MANUAL") !== f.origem) return false;
      if (f.busca && !Utils.contem(l.descricao, f.busca)) return false;
      return true;
    });
    var entradas = lancamentos.filter(function (l) { return l.tipo === "ENTRADA"; })
      .reduce(function (t, l) { return t + Utils.numero(l.valor); }, 0);
    var saidas = lancamentos.filter(function (l) { return l.tipo === "SAIDA"; })
      .reduce(function (t, l) { return t + Utils.numero(l.valor); }, 0);
    var todosCaixa = DB.read("caixa");
    var vendasCaixa = Domain.caixaDeVendas();
    var vendasVista = DB.read("vendas").filter(function (v) { return String(v.recebimento || "PRAZO") === "VISTA"; }).length;
    var comissoesPagas = todosCaixa.filter(function (l) { return l.origem === "COMISSAO"; })
      .reduce(function (t, l) { return t + Utils.numero(l.valor); }, 0);
    var e = estado.editando || {};
    el.innerHTML = UI.pagina("Fluxo de Caixa", "Entradas e saídas integradas com vendas, compras e comissões",
      '<div class="grid g4" style="margin-bottom:18px">' +
        UI.stat("Entradas", Utils.moeda(entradas), "c2") +
        UI.stat("Saídas", Utils.moeda(saidas), "c4") +
        UI.stat("Saldo", Utils.moeda(entradas - saidas), "c1") +
        UI.stat("Lançamentos", lancamentos.length, "c5") +
      "</div>" +
      '<div class="grid g4" style="margin-bottom:18px">' +
        UI.stat("Entradas de vendas", Utils.moeda(vendasCaixa), "c6") +
        UI.stat("Saldo geral do caixa", Utils.moeda(Domain.saldoCaixa()), "c3") +
        UI.stat("Vendas à vista integradas", vendasVista, "c2") +
        UI.stat("Comissões pagas", Utils.moeda(comissoesPagas), "c4") +
      "</div>" +
      UI.filtros(
        UI.campo("Data inicial", UI.input("de", { type: "date", value: f.de || "" })) +
        UI.campo("Data final", UI.input("ate", { type: "date", value: f.ate || "" })) +
        UI.campo("Tipo", UI.select("tipo", [
          { valor: "", label: "Entradas e saídas" }, { valor: "ENTRADA", label: "Somente entradas" },
          { valor: "SAIDA", label: "Somente saídas" }], f.tipo || "")) +
        UI.campo("Origem", UI.select("origem", [
          { valor: "", label: "Todas as origens" }, { valor: "VENDA", label: "Vendas" },
          { valor: "COMPRA", label: "Compras" }, { valor: "COMISSAO", label: "Comissões" },
          { valor: "MANUAL", label: "Lançamento manual" }], f.origem || "")) +
        UI.campo("Buscar descrição", UI.input("busca", { value: f.busca || "", placeholder: "Digite para filtrar..." })),
        '<div class="resumo">' +
          '<div><div class="k">Lançamentos filtrados</div><div class="v">' + lancamentos.length + "</div></div>" +
          '<div><div class="k">Entradas no período</div><div class="v">' + Utils.moeda(entradas) + "</div></div>" +
          '<div><div class="k">Saídas no período</div><div class="v">' + Utils.moeda(saidas) + "</div></div>" +
          '<div class="destaque"><div class="k">Resultado do período</div><div class="v">' + Utils.moeda(entradas - saidas) + "</div></div>" +
        "</div>") +
      '<div class="card"><h2>' + (estado.editando ? "Editar lançamento" : "Novo lançamento") + "</h2>" +
      '<form id="frm"><div class="grid g2 linhas">' +
        UI.campo("Data", UI.input("data", { type: "date", value: e.data || Utils.hoje() })) +
        UI.campo("Tipo", UI.select("tipo", ["ENTRADA", "SAIDA"], e.tipo)) +
        UI.campo("Descrição", UI.input("descricao", { value: e.descricao })) +
        UI.campo("Valor (R$)", UI.moeda("valor", e.valor)) +
      "</div>" + UI.acoes(estado.editando, "Lançar") + "</form></div>" +
      '<div class="card"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">Movimento</h2>' +
      '<button class="btn ghost right" id="exp">Exportar Excel</button></div>' +
      UI.tabela([
        { label: "Data", render: function (l) { return Utils.dataBR(l.data); } },
        { label: "Tipo", render: function (l) { return UI.badge(l.tipo, l.tipo === "ENTRADA" ? "ok" : "bad"); } },
        { label: "Descrição", chave: "descricao" },
        { label: "Origem", render: function (l) { return UI.badge(l.origem || "MANUAL", l.origem === "VENDA" ? "ok" : "info"); } },
        { label: "Valor", render: function (l) { return Utils.moeda(l.valor); } },
        { label: "Ações", render: function (l) {
            return '<button class="btn sm ghost" data-edit="' + l.id + '">Editar</button> ' +
              '<button class="btn sm danger" data-del="' + l.id + '">Excluir</button>'; } }
      ], lancamentos, "Nenhum lançamento encontrado para os filtros aplicados.") + "</div>");

    UI.ligarFiltros(el, estado, function () { Router.refresh(); });

    el.querySelector("#frm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var d = UI.dados(ev.target);
      if (!d.descricao) return alert("Informe a descrição do lançamento.");
      var reg = { data: d.data, tipo: d.tipo, descricao: d.descricao, valor: Utils.numero(d.valor), origem: "MANUAL" };
      if (estado.editando) { DB.update("caixa", estado.editando.id, reg); estado.editando = null; }
      else Domain.lancarCaixa(reg);
    });

    UI.ligarCancelar(el, function () { estado.editando = null; Router.refresh(); });

    el.querySelector("#exp").addEventListener("click", function () {
      Utils.exportarCSV("fluxo-de-caixa", [
        { label: "Data", valor: function (l) { return Utils.dataBR(l.data); } }, { label: "Tipo", chave: "tipo" },
        { label: "Descrição", chave: "descricao" },
        { label: "Valor", valor: function (l) { return Utils.moeda(l.valor); } }
      ], lancamentos);
    });
    el.addEventListener("click", function (ev) {
      var edit = ev.target.getAttribute && ev.target.getAttribute("data-edit");
      var del = ev.target.getAttribute && ev.target.getAttribute("data-del");
      if (edit) { estado.editando = lancamentos.filter(function (l) { return l.id === edit; })[0]; Router.refresh(); }
      if (del && confirm("Excluir lançamento?")) DB.remove("caixa", del);
    });
  };
})(window);

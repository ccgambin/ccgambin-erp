/* Contas a pagar e a receber — edição, cancelamento e baixa no caixa */
(function (w) {
  w.Modulos = w.Modulos || {};
  function tela(colecao, titulo) {
    var estado = { editando: null, filtros: {} };
    return function (el) {
      var f = estado.filtros || {};
      var lista = DB.read(colecao).slice().sort(function (a, b) { return String(a.vencimento).localeCompare(String(b.vencimento)); })
        .filter(function (c) {
          if (!Utils.entreDatas(c.vencimento, f.de, f.ate)) return false;
          if (f.status === "VENCIDO") { if (c.status !== "ABERTO" || c.vencimento >= Utils.hoje()) return false; }
          else if (f.status && c.status !== f.status) return false;
          if (f.origem && String(c.origem || "MANUAL") !== f.origem) return false;
          if (f.busca && !Utils.contem(c.descricao, f.busca)) return false;
          return true;
        });
      var aberto = lista.filter(function (c) { return c.status === "ABERTO"; });
      var pago = lista.filter(function (c) { return c.status === "PAGO"; });
      var soma = function (arr) { return arr.reduce(function (t, c) { return t + Utils.numero(c.valor); }, 0); };
      var e = estado.editando || {};
      el.innerHTML = UI.pagina(titulo, "Controle de títulos e baixas",
        '<div class="grid g4" style="margin-bottom:18px">' +
          UI.stat("Em aberto", Utils.moeda(soma(aberto)), "c4") +
          UI.stat("Baixados", Utils.moeda(soma(pago)), "c2") +
          UI.stat("Títulos abertos", aberto.length, "c3") +
          UI.stat("Total de títulos", lista.length, "c1") +
        "</div>" +
        UI.filtros(
          UI.campo("Vencimento de", UI.input("de", { type: "date", value: f.de || "" })) +
          UI.campo("Vencimento até", UI.input("ate", { type: "date", value: f.ate || "" })) +
          UI.campo("Situação", UI.select("status", [
            { valor: "", label: "Todas" }, { valor: "ABERTO", label: "Em aberto" },
            { valor: "VENCIDO", label: "Vencidos" }, { valor: "PAGO", label: "Baixados" }], f.status || "")) +
          UI.campo("Origem", UI.select("origem", [
            { valor: "", label: "Todas as origens" }, { valor: "VENDA", label: "Vendas" },
            { valor: "COMPRA", label: "Compras" }, { valor: "COMISSAO", label: "Comissões" },
            { valor: "MANUAL", label: "Manual" }], f.origem || "")) +
          UI.campo("Buscar descrição", UI.input("busca", { value: f.busca || "", placeholder: "Digite para filtrar..." })),
          '<div class="resumo">' +
            '<div><div class="k">Títulos filtrados</div><div class="v">' + lista.length + "</div></div>" +
            '<div><div class="k">Em aberto</div><div class="v">' + Utils.moeda(soma(aberto)) + "</div></div>" +
            '<div><div class="k">Baixados</div><div class="v">' + Utils.moeda(soma(pago)) + "</div></div>" +
            '<div class="destaque"><div class="k">Total filtrado</div><div class="v">' + Utils.moeda(soma(lista)) + "</div></div>" +
          "</div>") +
        '<div class="card"><h2>' + (estado.editando ? "Editar título" : "Novo título") + "</h2>" +
        '<form id="frm"><div class="grid g2 linhas">' +
          UI.campo("Descrição", UI.input("descricao", { value: e.descricao })) +
          UI.campo("Valor (R$)", UI.moeda("valor", e.valor)) +
          UI.campo("Vencimento", UI.input("vencimento", { type: "date", value: e.vencimento || Utils.hoje() })) +
        "</div>" + UI.acoes(estado.editando) + "</form></div>" +
        '<div class="card"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">Títulos</h2>' +
        '<button class="btn ghost right" id="exp">Exportar Excel</button></div>' +
        UI.tabela([
          { label: "Descrição", chave: "descricao" },
          { label: "Valor", render: function (c) { return Utils.moeda(c.valor); } },
          { label: "Vencimento", render: function (c) { return Utils.dataBR(c.vencimento); } },
          { label: "Origem", chave: "origem" },
          { label: "Status", render: function (c) {
              if (c.status === "PAGO") return UI.badge("BAIXADO", "ok");
              return UI.badge(c.vencimento < Utils.hoje() ? "VENCIDO" : "ABERTO", c.vencimento < Utils.hoje() ? "bad" : "warn"); } },
          { label: "Ações", render: function (c) {
              return (c.status === "ABERTO" ? '<button class="btn sm ok" data-baixa="' + c.id + '">Baixar</button> ' : "") +
                '<button class="btn sm ghost" data-edit="' + c.id + '">Editar</button> ' +
                '<button class="btn sm danger" data-del="' + c.id + '">Excluir</button>'; } }
        ], lista, "Nenhum título encontrado para os filtros aplicados.") + "</div>");

      UI.ligarFiltros(el, estado, function () { Router.refresh(); });

      el.querySelector("#frm").addEventListener("submit", function (ev) {
        ev.preventDefault();
        var d = UI.dados(ev.target);
        if (!d.descricao) return alert("Informe a descrição do título.");
        if (estado.editando) {
          DB.update(colecao, estado.editando.id, { descricao: d.descricao, valor: Utils.numero(d.valor), vencimento: d.vencimento });
          estado.editando = null;
        } else {
          DB.insert(colecao, { descricao: d.descricao, valor: Utils.numero(d.valor), vencimento: d.vencimento, status: "ABERTO", origem: "MANUAL" });
        }
      });

      UI.ligarCancelar(el, function () { estado.editando = null; Router.refresh(); });

      el.querySelector("#exp").addEventListener("click", function () {
        Utils.exportarCSV(colecao, [
          { label: "Descrição", chave: "descricao" },
          { label: "Valor", valor: function (c) { return Utils.moeda(c.valor); } },
          { label: "Vencimento", valor: function (c) { return Utils.dataBR(c.vencimento); } },
          { label: "Status", chave: "status" }, { label: "Origem", chave: "origem" }
        ], lista);
      });
      el.addEventListener("click", function (ev) {
        var b = ev.target.getAttribute && ev.target.getAttribute("data-baixa");
        var edit = ev.target.getAttribute && ev.target.getAttribute("data-edit");
        var del = ev.target.getAttribute && ev.target.getAttribute("data-del");
        if (b) Domain.baixarConta(colecao, b);
        if (edit) { estado.editando = lista.filter(function (c) { return c.id === edit; })[0]; Router.refresh(); }
        if (del && confirm("Excluir título?")) DB.remove(colecao, del);
      });
    };
  }
  w.Modulos["contas-pagar"] = tela("contaspagar", "Contas a Pagar");
  w.Modulos["contas-receber"] = tela("contasreceber", "Contas a Receber");
})(window);

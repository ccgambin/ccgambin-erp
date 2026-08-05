/* Compras e vendas — filtros por período, estoque bloqueado, títulos financeiros, comissão e caixa */
(function (w) {
  w.Modulos = w.Modulos || {};
  function tela(tipo) {
    var compra = tipo === "compras";
    var colecaoPessoa = compra ? "fornecedores" : "clientes";
    var campoPessoa = compra ? "fornecedorId" : "clienteId";
    var rotuloPessoa = compra ? "Fornecedor" : "Vendedor(a)";
    var estado = { editando: null, filtros: {} };

    return function (el) {
      var produtos = DB.read("produtos");
      var pessoas = DB.read(colecaoPessoa);
      var f = estado.filtros || {};
      var todos = DB.read(tipo).slice().reverse();
      /* Filtros: período, pessoa, produto e documento */
      var lista = todos.filter(function (r) {
        if (!Utils.entreDatas(r.data, f.de, f.ate)) return false;
        if (f.pessoa && r[campoPessoa] !== f.pessoa) return false;
        if (f.produto && r.produtoId !== f.produto) return false;
        if (f.perc && String(r.comissaoPerc || "05") !== f.perc) return false;
        if (f.busca && !Utils.contem(
          [r.documento, Domain.nomeProduto(r.produtoId), Domain.nomePessoa(colecaoPessoa, r[campoPessoa])].join(" "),
          f.busca)) return false;
        return true;
      });
      var e = estado.editando || {};
      var totalPeriodo = lista.reduce(function (t, r) { return t + Utils.numero(r.total); }, 0);
      var totalComissao = lista.reduce(function (t, r) { return t + Utils.numero(r.comissaoValor); }, 0);
      var qtdPeriodo = lista.reduce(function (t, r) { return t + Utils.numero(r.quantidade); }, 0);

      var opcoesPessoa = [{ valor: "", label: pessoas.length ? "Selecione..." : "Nenhum registro cadastrado" }]
        .concat(pessoas.map(function (p) { return { valor: p.id, label: p.nome }; }));
      var opcoesProduto = [{ valor: "", label: produtos.length ? "Selecione o produto..." : "Nenhum produto cadastrado" }]
        .concat(produtos.map(function (p) {
          return { valor: p.id, label: p.codigo + " - " + p.descricao + " (estoque: " + Utils.numero(p.estoque) + ")" };
        }));

      el.innerHTML = UI.pagina(compra ? "Compras" : "Vendas",
        compra ? "Compra gera entrada de estoque e conta a pagar"
               : "Venda exige estoque disponível e integra comissão, contas a receber e fluxo de caixa",
        '<div class="grid g4" style="margin-bottom:18px">' +
          UI.stat(compra ? "Compras no filtro" : "Vendas no filtro", lista.length, "c1") +
          UI.stat(compra ? "Total comprado" : "Total vendido no período", Utils.moeda(totalPeriodo), "c2") +
          (compra ? UI.stat("Fornecedores", pessoas.length, "c6")
                  : UI.stat("Comissão total do período", Utils.moeda(totalComissao), "c3")) +
          UI.stat(compra ? "Contas a pagar abertas" : "Recebido de vendas (caixa)",
            compra ? DB.read("contaspagar").filter(function (c) { return c.status === "ABERTO"; }).length
                   : Utils.moeda(Domain.caixaDeVendas()),
            compra ? "c4" : "c5") +
        "</div>" +

        /* ---- Filtros ---- */
        UI.filtros(
          UI.campo("Data inicial", UI.input("de", { type: "date", value: f.de || "" })) +
          UI.campo("Data final", UI.input("ate", { type: "date", value: f.ate || "" })) +
          UI.campo(rotuloPessoa, UI.select("pessoa",
            [{ valor: "", label: compra ? "Todos os fornecedores" : "Todas as vendedoras" }]
              .concat(pessoas.map(function (p) { return { valor: p.id, label: p.nome }; })), f.pessoa || "")) +
          UI.campo("Produto", UI.select("produto",
            [{ valor: "", label: "Todos os produtos" }]
              .concat(produtos.map(function (p) { return { valor: p.id, label: p.codigo + " - " + p.descricao }; })), f.produto || "")) +
          (compra ? "" : UI.campo("Comissão (%)", UI.select("perc",
            [{ valor: "", label: "Todas as faixas" }]
              .concat(Domain.COMISSOES.map(function (c) { return { valor: c, label: c + "%" }; })), f.perc || ""))) +
          UI.campo("Buscar (documento, produto, nome)", UI.input("busca", { value: f.busca || "", placeholder: "Digite para filtrar..." })),
          '<div class="resumo">' +
            '<div><div class="k">Registros filtrados</div><div class="v">' + lista.length + "</div></div>" +
            '<div><div class="k">Quantidade total</div><div class="v">' + qtdPeriodo + "</div></div>" +
            '<div><div class="k">' + (compra ? "Total comprado" : "Total vendido") + '</div><div class="v">' + Utils.moeda(totalPeriodo) + "</div></div>" +
            (compra ? "" : '<div class="destaque"><div class="k">Comissão no período</div><div class="v">' + Utils.moeda(totalComissao) + "</div></div>") +
          "</div>") +

        '<div class="card"><h2>' + (estado.editando ? "Editar registro" : "Novo registro") + "</h2>" +
        '<form id="frm"><div class="grid g2 linhas">' +
          UI.campo("Data", UI.input("data", { type: "date", value: e.data || Utils.hoje() })) +
          UI.campo(rotuloPessoa + (compra ? " (cadastrado)" : ""),
            UI.select(campoPessoa, opcoesPessoa, e[campoPessoa])
              .replace('name="' + campoPessoa + '"', 'name="' + campoPessoa + '" id="selPessoa"')) +
          (compra
            ? UI.campo("CNPJ do fornecedor", UI.input("fornecedorDoc", { id: "docPessoa", readonly: true, value: e.fornecedorDoc, placeholder: "Preenchido automaticamente" })) +
              UI.campo("Cidade do fornecedor", UI.input("fornecedorCidade", { id: "cidPessoa", readonly: true, value: e.fornecedorCidade, placeholder: "Preenchido automaticamente" }))
            : "") +
          UI.campo("Produto", UI.select("produtoId", opcoesProduto, e.produtoId)
            .replace('name="produtoId"', 'name="produtoId" id="selProd"')) +
          (compra ? "" : UI.campo("Estoque disponível", UI.input("estoqueDisp", { id: "estDisp", readonly: true, placeholder: "Selecione o produto" }))) +
          UI.campo("Quantidade", UI.input("quantidade", { type: "number", step: "0.01", value: e.quantidade, id: "qtd" })) +
          UI.campo("Valor unitário (R$)", UI.moeda("valorUnitario", e.valorUnitario, { id: "vu" })) +
          (compra ? "" :
            UI.campo("Comissão (%)", UI.select("comissaoPerc",
              Domain.COMISSOES.map(function (c) { return { valor: c, label: c + "%" }; }),
              e.comissaoPerc || "05").replace('name="comissaoPerc"', 'name="comissaoPerc" id="selCom"')) +
            UI.campo("Recebimento", UI.select("recebimento", [
              { valor: "PRAZO", label: "A prazo (gera conta a receber)" },
              { valor: "VISTA", label: "À vista (entra no fluxo de caixa)" }
            ], e.recebimento || "PRAZO"))) +
          UI.campo("Prazo (dias)", UI.input("prazoDias", { type: "number", value: e.prazoDias == null ? 30 : e.prazoDias })) +
          UI.campo("Documento", UI.input("documento", { value: e.documento })) +
        "</div>" +
        (compra ? "" :
          '<div class="resumo" id="resumo">' +
            '<div><div class="k">Total da venda</div><div class="v" id="rTotal">R$ 0,00</div></div>' +
            '<div><div class="k">Comissão aplicada</div><div class="v" id="rPerc">05%</div></div>' +
            '<div class="destaque"><div class="k">Comissão da vendedora</div><div class="v" id="rCom">R$ 0,00</div></div>' +
            '<div><div class="k">Líquido da empresa</div><div class="v" id="rLiq">R$ 0,00</div></div>' +
          "</div>" +
          '<p class="erro" id="msgErro" style="text-align:left" hidden></p>' +
          '<p class="hint" style="text-align:left;margin:6px 0 8px">Vendas sem estoque suficiente são bloqueadas. Venda à vista lança a entrada direto no Fluxo de Caixa.</p>') +
        (estado.editando ? '<p class="hint" style="text-align:left;margin:0 0 10px">A edição recalcula total e comissão do registro; estoque e títulos já gerados não são refeitos.</p>' : "") +
        UI.acoes(estado.editando, "Registrar") + "</form></div>" +
        '<div class="card"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">Histórico</h2>' +
        '<button class="btn ghost right" id="exp">Exportar Excel</button></div>' +
        UI.tabela([
          { label: "Data", render: function (r) { return Utils.dataBR(r.data); } },
          { label: rotuloPessoa, render: function (r) { return UI.esc(Domain.nomePessoa(colecaoPessoa, r[campoPessoa])); } },
          { label: "Produto", render: function (r) { return UI.esc(Domain.nomeProduto(r.produtoId)); } },
          { label: "Qtd", chave: "quantidade" },
          { label: "Unitário", render: function (r) { return Utils.moeda(r.valorUnitario); } },
          { label: "Total", render: function (r) { return Utils.moeda(r.total); } }
        ].concat(compra ? [] : [
          { label: "Comissão %", render: function (r) { return UI.badge((r.comissaoPerc || "05") + "%", "info"); } },
          { label: "Comissão R$", render: function (r) { return Utils.moeda(r.comissaoValor); } },
          { label: "Recebimento", render: function (r) {
              return UI.badge(String(r.recebimento || "PRAZO") === "VISTA" ? "À VISTA" : "A PRAZO",
                String(r.recebimento || "PRAZO") === "VISTA" ? "ok" : "warn"); } }
        ]).concat([
          { label: "Documento", chave: "documento" },
          { label: "Ações", render: function (r) {
              return '<button class="btn sm ghost" data-edit="' + r.id + '">Editar</button> ' +
                '<button class="btn sm danger" data-del="' + r.id + '">Excluir</button>'; } }
        ]), lista, "Nenhum registro encontrado para os filtros aplicados.") + "</div>" +
        (compra ? "" :
          '<div class="card"><h2>Comissão por vendedora no período</h2>' +
          UI.tabela([
            { label: "Vendedora", render: function (r) { return UI.esc(r.vendedor); } },
            { label: "Vendas", chave: "vendas" },
            { label: "Total vendido", render: function (r) { return Utils.moeda(r.total); } },
            { label: "Comissão", render: function (r) { return Utils.moeda(r.comissao); } }
          ], resumoComissoes(lista), "Nenhuma venda no período filtrado.") + "</div>"));

      /* Agrupa as vendas filtradas por vendedora */
      function resumoComissoes(vendas) {
        var mapa = {};
        vendas.forEach(function (v) {
          var k = v.clienteId || "-";
          mapa[k] = mapa[k] || { vendedor: Domain.nomePessoa("clientes", k), vendas: 0, total: 0, comissao: 0 };
          mapa[k].vendas += 1;
          mapa[k].total += Utils.numero(v.total);
          mapa[k].comissao += Utils.numero(v.comissaoValor);
        });
        return Object.keys(mapa).map(function (k) { return mapa[k]; })
          .sort(function (a, b) { return b.comissao - a.comissao; });
      }

      var form = el.querySelector("#frm");
      UI.ligarFiltros(el, estado, function () { Router.refresh(); });

      /* Fornecedor buscado automaticamente no módulo de Compras */
      if (compra) {
        var selPessoa = el.querySelector("#selPessoa");
        function preencherFornecedor() {
          var forn = pessoas.filter(function (p) { return p.id === selPessoa.value; })[0];
          el.querySelector("#docPessoa").value = forn ? Utils.mascaraDocumento(forn.documento) : "";
          el.querySelector("#cidPessoa").value = forn ? [forn.cidade, forn.uf].filter(Boolean).join("/") : "";
        }
        selPessoa.addEventListener("change", preencherFornecedor);
        if (selPessoa.value) preencherFornecedor();
      }

      /* Cálculo automático de comissão e checagem de estoque nas vendas */
      if (!compra) {
        var msgErro = el.querySelector("#msgErro");
        function erro(txt) { msgErro.textContent = txt || ""; msgErro.hidden = !txt; }
        function produtoSelecionado() {
          return produtos.filter(function (p) { return p.id === form.elements["produtoId"].value; })[0];
        }
        function atualizarEstoque() {
          var p = produtoSelecionado();
          var campo = el.querySelector("#estDisp");
          campo.value = p ? Utils.numero(p.estoque) + " " + (p.unidade || "UN") : "";
          var qtd = Utils.numero(form.elements["quantidade"].value);
          if (p && qtd > Utils.numero(p.estoque)) {
            erro("Estoque insuficiente: disponível " + Utils.numero(p.estoque) + " " + (p.unidade || "UN") + ".");
          } else erro("");
        }
        function recalcular() {
          var total = Utils.numero(form.elements["quantidade"].value) * Utils.numero(form.elements["valorUnitario"].value);
          var perc = form.elements["comissaoPerc"].value;
          var com = Domain.calcularComissao(total, perc);
          el.querySelector("#rTotal").textContent = Utils.moeda(total);
          el.querySelector("#rPerc").textContent = perc + "%";
          el.querySelector("#rCom").textContent = Utils.moeda(com);
          el.querySelector("#rLiq").textContent = Utils.moeda(total - com);
          atualizarEstoque();
        }
        ["qtd", "vu", "selCom"].forEach(function (id) {
          var c = el.querySelector("#" + id);
          if (c) { c.addEventListener("input", recalcular); c.addEventListener("change", recalcular); }
        });
        /* Comissão padrão do vendedor(a) selecionado */
        el.querySelector("#selPessoa").addEventListener("change", function (ev) {
          var v = pessoas.filter(function (p) { return p.id === ev.target.value; })[0];
          if (v && v.comissaoPadrao) form.elements["comissaoPerc"].value = v.comissaoPadrao;
          recalcular();
        });
        /* Preço de venda sugerido pelo cadastro do produto */
        el.querySelector("#selProd").addEventListener("change", function (ev) {
          var p = produtos.filter(function (x) { return x.id === ev.target.value; })[0];
          if (p && !Utils.numero(form.elements["valorUnitario"].value)) {
            form.elements["valorUnitario"].value = Utils.moedaTexto(p.venda);
          }
          recalcular();
        });
        recalcular();
      }

      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var d = UI.dados(ev.target);
        if (!d.produtoId) return alert("Selecione o produto (cadastre um produto primeiro).");
        if (!d[campoPessoa]) return alert("Selecione o " + rotuloPessoa.toLowerCase() + " (cadastre-o primeiro).");
        if (Utils.numero(d.quantidade) <= 0) return alert("Informe a quantidade.");
        if (estado.editando) {
          var total = Utils.numero(d.quantidade) * Utils.numero(d.valorUnitario);
          var patch = {
            data: d.data, produtoId: d.produtoId, quantidade: Utils.numero(d.quantidade),
            valorUnitario: Utils.numero(d.valorUnitario), prazoDias: Utils.numero(d.prazoDias),
            documento: d.documento, total: total
          };
          patch[campoPessoa] = d[campoPessoa];
          if (!compra) {
            patch.comissaoPerc = d.comissaoPerc;
            patch.recebimento = d.recebimento;
            patch.comissaoValor = Domain.calcularComissao(total, d.comissaoPerc);
            Domain.ressincronizarComissao(estado.editando, patch);
          }
          DB.update(tipo, estado.editando.id, patch);
          estado.editando = null;
          return;
        }
        try {
          if (compra) Domain.registrarCompra(d); else Domain.registrarVenda(d);
        } catch (err) {
          alert(err && err.message ? err.message : "Não foi possível registrar.");
        }
      });

      UI.ligarCancelar(el, function () { estado.editando = null; Router.refresh(); });

      el.querySelector("#exp").addEventListener("click", function () {
        Utils.exportarCSV(tipo, [
          { label: "Data", chave: "data" },
          { label: rotuloPessoa, valor: function (r) { return Domain.nomePessoa(colecaoPessoa, r[campoPessoa]); } },
          { label: "Produto", valor: function (r) { return Domain.nomeProduto(r.produtoId); } },
          { label: "Qtd", chave: "quantidade" },
          { label: "Unitário", valor: function (r) { return Utils.moeda(r.valorUnitario); } },
          { label: "Total", valor: function (r) { return Utils.moeda(r.total); } }
        ].concat(compra ? [] : [
          { label: "Comissão %", chave: "comissaoPerc" },
          { label: "Comissão R$", valor: function (r) { return Utils.moeda(r.comissaoValor); } },
          { label: "Recebimento", valor: function (r) { return r.recebimento || "PRAZO"; } }
        ]).concat([{ label: "Documento", chave: "documento" }]), lista);
      });

      el.addEventListener("click", function (ev) {
        var edit = ev.target.getAttribute && ev.target.getAttribute("data-edit");
        var del = ev.target.getAttribute && ev.target.getAttribute("data-del");
        if (edit) { estado.editando = lista.filter(function (r) { return r.id === edit; })[0]; Router.refresh(); }
        if (del && confirm("Excluir este registro do histórico?")) DB.remove(tipo, del);
      });
    };
  }
  w.Modulos.compras = tela("compras");
  w.Modulos.vendas = tela("vendas");
})(window);

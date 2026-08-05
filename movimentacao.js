/* Entradas e saídas manuais de mercadorias — entrada com fornecedor buscado automaticamente */
(function (w) {
  w.Modulos = w.Modulos || {};
  function tela(tipo) {
    var entrada = tipo === "ENTRADA";
    var estado = { editando: null, filtros: {} };
    return function (el) {
      var produtos = DB.read("produtos");
      var fornecedores = DB.read("fornecedores");
      var f = estado.filtros || {};
      var movs = DB.read("movimentos").filter(function (m) { return m.tipo === tipo; }).slice().reverse()
        .filter(function (m) {
          if (!Utils.entreDatas(m.data, f.de, f.ate)) return false;
          if (f.produto && m.produtoId !== f.produto) return false;
          if (f.fornecedor && m.fornecedorId !== f.fornecedor) return false;
          if (f.busca && !Utils.contem([m.documento, m.obs, Domain.nomeProduto(m.produtoId)].join(" "), f.busca)) return false;
          return true;
        });
      var titulo = entrada ? "Entrada de Mercadorias" : "Saída de Mercadorias";
      var e = estado.editando || {};
      var totalMov = movs.reduce(function (t, m) { return t + Utils.numero(m.valor); }, 0);

      el.innerHTML = UI.pagina(titulo,
        entrada ? "Movimentação manual de estoque com fornecedor do cadastro" : "Movimentação manual de estoque",
        '<div class="grid g4" style="margin-bottom:18px">' +
          UI.stat("Movimentos", movs.length, "c1") +
          UI.stat("Unidades", movs.reduce(function (t, m) { return t + Utils.numero(m.quantidade); }, 0), entrada ? "c2" : "c4") +
          UI.stat("Valor movimentado", Utils.moeda(totalMov), "c3") +
          UI.stat(entrada ? "Fornecedores" : "Produtos", entrada ? fornecedores.length : produtos.length, entrada ? "c6" : "c5") +
        "</div>" +
        UI.filtros(
          UI.campo("Data inicial", UI.input("de", { type: "date", value: f.de || "" })) +
          UI.campo("Data final", UI.input("ate", { type: "date", value: f.ate || "" })) +
          UI.campo("Produto", UI.select("produto", [{ valor: "", label: "Todos os produtos" }]
            .concat(produtos.map(function (p) { return { valor: p.id, label: p.codigo + " - " + p.descricao }; })), f.produto || "")) +
          (entrada ? UI.campo("Fornecedor", UI.select("fornecedor", [{ valor: "", label: "Todos os fornecedores" }]
            .concat(fornecedores.map(function (x) { return { valor: x.id, label: x.nome }; })), f.fornecedor || "")) : "") +
          UI.campo("Buscar (documento/observação)", UI.input("busca", { value: f.busca || "", placeholder: "Digite para filtrar..." })),
          '<div class="resumo">' +
            '<div><div class="k">Movimentos filtrados</div><div class="v">' + movs.length + "</div></div>" +
            '<div><div class="k">Unidades</div><div class="v">' + movs.reduce(function (t, m) { return t + Utils.numero(m.quantidade); }, 0) + "</div></div>" +
            '<div class="destaque"><div class="k">Valor no período</div><div class="v">' + Utils.moeda(totalMov) + "</div></div>" +
          "</div>") +
        '<div class="card"><h2>' + (estado.editando ? "Editar movimento" : "Registrar " + (entrada ? "entrada" : "saída")) + "</h2>" +
        '<form id="frm"><div class="grid g2 linhas">' +
          UI.campo("Data", UI.input("data", { type: "date", value: e.data || Utils.hoje() })) +
          (entrada
            ? UI.campo("Fornecedor (cadastrado)", UI.select("fornecedorId",
                [{ valor: "", label: fornecedores.length ? "Selecione o fornecedor..." : "Nenhum fornecedor cadastrado" }]
                  .concat(fornecedores.map(function (f) { return { valor: f.id, label: f.nome }; })), e.fornecedorId)
                  .replace('name="fornecedorId"', 'name="fornecedorId" id="selForn"')) +
              UI.campo("Fornecedor (nome)", UI.input("fornecedor", { id: "nomeForn", readonly: true, value: e.fornecedor, placeholder: "Preenchido automaticamente" })) +
              UI.campo("CNPJ do fornecedor", UI.input("fornecedorDoc", { id: "docForn", readonly: true, value: e.fornecedorDoc, placeholder: "Preenchido automaticamente" })) +
              UI.campo("Cidade/UF", UI.input("fornecedorCidade", { id: "cidForn", readonly: true, value: e.fornecedorCidade, placeholder: "Preenchido automaticamente" }))
            : "") +
          UI.campo("Produto", UI.select("produtoId", [{ valor: "", label: produtos.length ? "Selecione o produto..." : "Nenhum produto cadastrado" }]
            .concat(produtos.map(function (p) { return { valor: p.id, label: p.codigo + " - " + p.descricao }; })), e.produtoId)
            .replace('name="produtoId"', 'name="produtoId" id="selProd"')) +
          UI.campo("Quantidade", UI.input("quantidade", { type: "number", step: "0.01", value: e.quantidade })) +
          UI.campo("Valor total (R$)", UI.moeda("valor", e.valor)) +
          UI.campo("Documento", UI.input("documento", { value: e.documento })) +
          UI.campo("Observação", UI.input("obs", { value: e.obs })) +
        "</div>" +
        (entrada ? '<p class="hint" style="text-align:left;margin:10px 0 8px">Ao selecionar o fornecedor, nome, CNPJ e cidade são buscados automaticamente do cadastro de Fornecedores.</p>' : "") +
        UI.acoes(estado.editando, "Registrar") + "</form></div>" +
        '<div class="card"><h2>Histórico</h2>' +
        UI.tabela([
          { label: "Data", render: function (m) { return Utils.dataBR(m.data); } }
        ].concat(entrada ? [{ label: "Fornecedor", render: function (m) {
              return UI.esc(m.fornecedor || Domain.nomePessoa("fornecedores", m.fornecedorId)); } }] : [])
         .concat([
          { label: "Produto", render: function (m) { return UI.esc(Domain.nomeProduto(m.produtoId)); } },
          { label: "Qtd", chave: "quantidade" },
          { label: "Valor", render: function (m) { return Utils.moeda(m.valor); } },
          { label: "Documento", chave: "documento" },
          { label: "Obs", chave: "obs" },
          { label: "Ações", render: function (m) {
              return '<button class="btn sm ghost" data-edit="' + m.id + '">Editar</button> ' +
                '<button class="btn sm danger" data-del="' + m.id + '">Excluir</button>'; } }
        ]), movs, "Nenhum movimento encontrado para os filtros aplicados.") + "</div>");

      UI.ligarFiltros(el, estado, function () { Router.refresh(); });

      if (entrada) {
        var selForn = el.querySelector("#selForn");
        function preencherFornecedor() {
          var f = fornecedores.filter(function (x) { return x.id === selForn.value; })[0];
          el.querySelector("#nomeForn").value = f ? f.nome : "";
          el.querySelector("#docForn").value = f ? Utils.mascaraDocumento(f.documento) : "";
          el.querySelector("#cidForn").value = f ? [f.cidade, f.uf].filter(Boolean).join("/") : "";
        }
        selForn.addEventListener("change", preencherFornecedor);
        if (selForn.value && !el.querySelector("#nomeForn").value) preencherFornecedor();
      }

      /* Sugestão do valor total pelo custo cadastrado do produto */
      var form = el.querySelector("#frm");
      el.querySelector("#selProd").addEventListener("change", function (ev) {
        var p = produtos.filter(function (x) { return x.id === ev.target.value; })[0];
        var qtd = Utils.numero(form.elements["quantidade"].value);
        if (p && qtd > 0 && !Utils.numero(form.elements["valor"].value)) {
          form.elements["valor"].value = Utils.moedaTexto(Utils.numero(entrada ? p.custo : p.venda) * qtd);
        }
      });

      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var d = UI.dados(ev.target);
        if (!d.produtoId) return alert("Selecione o produto (cadastre um produto antes de movimentar o estoque).");
        if (entrada && !d.fornecedorId) return alert("Selecione o fornecedor. Cadastre-o antes no módulo Fornecedores.");
        var qtd = Utils.numero(d.quantidade);
        if (qtd <= 0) return alert("Informe a quantidade.");
        var sinal = entrada ? 1 : -1;
        var base = {
          data: d.data, produtoId: d.produtoId, quantidade: qtd,
          valor: Utils.numero(d.valor), documento: d.documento, obs: d.obs
        };
        if (entrada) {
          base.fornecedorId = d.fornecedorId;
          base.fornecedor = d.fornecedor;
          base.fornecedorDoc = d.fornecedorDoc;
          base.fornecedorCidade = d.fornecedorCidade;
        }
        if (estado.editando) {
          var antigo = estado.editando;
          Domain.ajustarEstoque(antigo.produtoId, -sinal * Utils.numero(antigo.quantidade));
          DB.update("movimentos", antigo.id, base);
          Domain.ajustarEstoque(d.produtoId, sinal * qtd);
          estado.editando = null;
        } else {
          try {
            Domain.registrarMovimento(Object.assign({ tipo: tipo }, base));
          } catch (err) {
            alert(err && err.message ? err.message : "Não foi possível registrar o movimento.");
          }
        }
      });

      UI.ligarCancelar(el, function () { estado.editando = null; Router.refresh(); });

      el.addEventListener("click", function (ev) {
        var edit = ev.target.getAttribute && ev.target.getAttribute("data-edit");
        var del = ev.target.getAttribute && ev.target.getAttribute("data-del");
        if (edit) { estado.editando = movs.filter(function (m) { return m.id === edit; })[0]; Router.refresh(); }
        if (del && confirm("Excluir este movimento? O estoque será reajustado.")) {
          var m = movs.filter(function (x) { return x.id === del; })[0];
          if (m) {
            Domain.ajustarEstoque(m.produtoId, (entrada ? -1 : 1) * Utils.numero(m.quantidade));
            DB.remove("movimentos", del);
          }
        }
      });
    };
  }
  w.Modulos.entrada = tela("ENTRADA");
  w.Modulos.saida = tela("SAIDA");
})(window);

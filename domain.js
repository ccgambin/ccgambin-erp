/* Regras de negócio: estoque, compras, vendas, comissões, contas e caixa */
(function (w) {
  var U = w.Utils;
  var CATEGORIAS = ["Alimentos", "Bebidas", "Cama-Mesa-Banho", "Limpeza", "Higiene", "Diversos"];
  var UNIDADES = ["UN", "KG", "CX", "LT", "PC"];
  /* Faixas de comissão disponíveis no módulo de Vendas */
  var COMISSOES = ["05", "10", "15", "20", "25", "30", "35"];

  function produto(id) { return DB.read("produtos").filter(function (p) { return p.id === id; })[0]; }
  function nomeProduto(id) { var p = produto(id); return p ? p.codigo + " - " + p.descricao : "-"; }
  function nomePessoa(col, id) {
    var p = DB.read(col).filter(function (x) { return x.id === id; })[0];
    return p ? p.nome : "-";
  }
  function fornecedorPorId(id) { return DB.read("fornecedores").filter(function (f) { return f.id === id; })[0] || null; }

  /* Comissão: total * percentual (05..35) */
  function calcularComissao(total, perc) {
    var t = U.numero(total);
    var p = U.numero(String(perc || "0").replace(/^0+(?=\d)/, ""));
    return Math.round(t * (p / 100) * 100) / 100;
  }

  function ajustarEstoque(produtoId, delta) {
    DB.write("produtos", DB.read("produtos").map(function (p) {
      return p.id === produtoId ? Object.assign({}, p, { estoque: U.numero(p.estoque) + delta }) : p;
    }));
  }
  /* Saldo disponível em estoque de um produto */
  function estoqueDisponivel(produtoId) {
    var p = produto(produtoId);
    return p ? U.numero(p.estoque) : 0;
  }
  /* Valida se a saída/venda cabe no estoque atual; retorna mensagem de erro ou "" */
  function validarSaida(produtoId, quantidade) {
    var qtd = U.numero(quantidade);
    var p = produto(produtoId);
    if (!p) return "Produto não encontrado.";
    if (qtd <= 0) return "Informe a quantidade.";
    var disp = U.numero(p.estoque);
    if (qtd > disp) {
      return "Venda bloqueada: estoque insuficiente de " + p.codigo + " - " + p.descricao +
        ". Disponível: " + disp + " " + (p.unidade || "UN") + ", solicitado: " + qtd + ".";
    }
    return "";
  }
  function registrarMovimento(m) {
    if (m.tipo === "SAIDA") {
      var erro = validarSaida(m.produtoId, m.quantidade);
      if (erro) throw new Error(erro);
    }
    DB.insert("movimentos", m);
    ajustarEstoque(m.produtoId, m.tipo === "ENTRADA" ? U.numero(m.quantidade) : -U.numero(m.quantidade));
  }
  function lancarCaixa(c) { DB.insert("caixa", c); }
  function saldoCaixa() {
    return DB.read("caixa").reduce(function (t, l) {
      return t + (l.tipo === "ENTRADA" ? U.numero(l.valor) : -U.numero(l.valor));
    }, 0);
  }
  /* Total recebido no caixa proveniente de vendas (à vista + títulos baixados) */
  function caixaDeVendas() {
    return DB.read("caixa").filter(function (l) { return l.origem === "VENDA"; })
      .reduce(function (t, l) { return t + U.numero(l.valor); }, 0);
  }
  function valorEstoque() {
    return DB.read("produtos").reduce(function (t, p) { return t + U.numero(p.custo) * U.numero(p.estoque); }, 0);
  }
  function estoqueBaixo() {
    return DB.read("produtos").filter(function (p) { return U.numero(p.estoque) <= U.numero(p.minimo); });
  }
  function totalComissoes() {
    return DB.read("vendas").reduce(function (t, v) { return t + U.numero(v.comissaoValor); }, 0);
  }
  /* Comissões agrupadas por vendedor(a) — usado em relatórios */
  function comissoesPorVendedor() {
    var mapa = {};
    DB.read("vendas").forEach(function (v) {
      var k = v.clienteId || "-";
      mapa[k] = mapa[k] || { vendedor: nomePessoa("clientes", k), vendas: 0, total: 0, comissao: 0 };
      mapa[k].vendas += 1;
      mapa[k].total += U.numero(v.total);
      mapa[k].comissao += U.numero(v.comissaoValor);
    });
    return Object.keys(mapa).map(function (k) { return mapa[k]; })
      .sort(function (a, b) { return b.comissao - a.comissao; });
  }

  function registrarCompra(d) {
    var total = U.numero(d.quantidade) * U.numero(d.valorUnitario);
    var f = fornecedorPorId(d.fornecedorId);
    DB.insert("compras", Object.assign({}, d, {
      total: total,
      fornecedor: f ? f.nome : d.fornecedor || "",
      fornecedorDoc: f ? f.documento : d.fornecedorDoc || "",
      fornecedorCidade: f ? [f.cidade, f.uf].filter(Boolean).join("/") : d.fornecedorCidade || ""
    }));
    registrarMovimento({
      data: d.data, tipo: "ENTRADA", produtoId: d.produtoId, quantidade: U.numero(d.quantidade),
      valor: total, documento: d.documento || "COMPRA", obs: "Gerado pelo módulo de Compras",
      fornecedorId: d.fornecedorId, fornecedor: f ? f.nome : ""
    });
    DB.insert("contaspagar", {
      descricao: ("Compra " + (d.documento || "") + " - " + nomePessoa("fornecedores", d.fornecedorId)).trim(),
      valor: total, vencimento: U.addDias(d.data || U.hoje(), d.prazoDias), status: "ABERTO", origem: "COMPRA"
    });
  }

  function registrarVenda(d) {
    /* Bloqueio de venda sem estoque */
    var erroEstoque = validarSaida(d.produtoId, d.quantidade);
    if (erroEstoque) throw new Error(erroEstoque);
    var total = U.numero(d.quantidade) * U.numero(d.valorUnitario);
    var perc = d.comissaoPerc || "05";
    var comissao = calcularComissao(total, perc);
    var venda = DB.insert("vendas", Object.assign({}, d, {
      total: total, comissaoPerc: perc, comissaoValor: comissao
    }));
    registrarMovimento({
      data: d.data, tipo: "SAIDA", produtoId: d.produtoId, quantidade: U.numero(d.quantidade),
      valor: total, documento: d.documento || "VENDA", obs: "Gerado pelo módulo de Vendas"
    });
    /* Fluxo de caixa integrado: à vista entra direto no caixa; a prazo gera título a receber */
    var aVista = String(d.recebimento || "PRAZO").toUpperCase() === "VISTA";
    var descricaoVenda = ("Venda " + (d.documento || venda.id) + " - " + nomePessoa("clientes", d.clienteId)).trim();
    if (aVista) {
      lancarCaixa({
        data: d.data || U.hoje(), tipo: "ENTRADA", descricao: descricaoVenda,
        valor: total, origem: "VENDA", vendaId: venda.id
      });
    } else {
      DB.insert("contasreceber", {
        descricao: descricaoVenda, valor: total,
        vencimento: U.addDias(d.data || U.hoje(), d.prazoDias),
        status: "ABERTO", origem: "VENDA", vendaId: venda.id
      });
    }
    /* Comissão integrada ao financeiro: título a pagar para o vendedor(a) */
    if (comissao > 0) {
      DB.insert("contaspagar", {
        descricao: "Comissão " + perc + "% - " + nomePessoa("clientes", d.clienteId) +
          " (venda " + (d.documento || venda.id) + ")",
        valor: comissao, vencimento: U.addDias(d.data || U.hoje(), d.prazoDias),
        status: "ABERTO", origem: "COMISSAO", vendaId: venda.id
      });
    }
    return venda;
  }

  /* Ao editar uma venda, atualiza o título de comissão vinculado */
  function ressincronizarComissao(vendaAntiga, patch) {
    var titulo = DB.read("contaspagar").filter(function (c) {
      return c.origem === "COMISSAO" && c.vendaId === vendaAntiga.id;
    })[0];
    var novoValor = U.numero(patch.comissaoValor);
    var descricao = "Comissão " + patch.comissaoPerc + "% - " +
      nomePessoa("clientes", patch.clienteId || vendaAntiga.clienteId) +
      " (venda " + (patch.documento || vendaAntiga.id) + ")";
    if (titulo) {
      if (novoValor <= 0) DB.remove("contaspagar", titulo.id);
      else if (titulo.status === "ABERTO") DB.update("contaspagar", titulo.id, { valor: novoValor, descricao: descricao });
    } else if (novoValor > 0) {
      DB.insert("contaspagar", {
        descricao: descricao, valor: novoValor,
        vencimento: U.addDias(patch.data || U.hoje(), patch.prazoDias),
        status: "ABERTO", origem: "COMISSAO", vendaId: vendaAntiga.id
      });
    }
  }

  function baixarConta(col, id) {
    var c = DB.read(col).filter(function (x) { return x.id === id; })[0];
    if (!c || c.status === "PAGO") return;
    DB.update(col, id, { status: "PAGO" });
    lancarCaixa({
      data: U.hoje(), tipo: col === "contasreceber" ? "ENTRADA" : "SAIDA",
      descricao: c.descricao, valor: U.numero(c.valor),
      origem: c.origem || "MANUAL", vendaId: c.vendaId || ""
    });
  }

  function gerarDadosDemo() {
    var fornecedores = [
      { id: DB.novoId(), nome: "Distribuidora Sul", documento: "11.222.333/0001-44", telefone: "(51) 3333-4444", email: "vendas@dsul.com", cep: "92010-020", endereco: "Rua Julio de Castilhos", numero: "100", bairro: "Centro", cidade: "Porto Alegre", uf: "RS" },
      { id: DB.novoId(), nome: "Higiclean", documento: "55.666.777/0001-88", telefone: "(51) 3222-1111", email: "comercial@higiclean.com", cep: "92310-000", endereco: "Av. Getúlio Vargas", numero: "2200", bairro: "Centro", cidade: "Canoas", uf: "RS" },
      { id: DB.novoId(), nome: "Bebidas Gambin", documento: "22.333.444/0001-55", telefone: "(54) 3444-5555", email: "contato@bebidasgambin.com", cep: "95700-000", endereco: "Rua das Vinícolas", numero: "45", bairro: "Centro", cidade: "Bento Gonçalves", uf: "RS" }
    ];
    DB.write("fornecedores", fornecedores);
    function forn(nome) { return fornecedores.filter(function (f) { return f.nome === nome; })[0]; }

    var base = [
      ["1001", "Arroz Branco 5kg", "Alimentos", "Distribuidora Sul", "PC", 22.5, 32.9, 40, 10],
      ["1002", "Feijão Preto 1kg", "Alimentos", "Distribuidora Sul", "PC", 6.2, 9.9, 60, 15],
      ["1003", "Refrigerante 2L", "Bebidas", "Bebidas Gambin", "UN", 5.1, 8.5, 8, 12],
      ["1004", "Detergente 500ml", "Limpeza", "Higiclean", "UN", 1.9, 3.5, 120, 20],
      ["1005", "Sabonete 90g", "Higiene", "Higiclean", "UN", 1.2, 2.5, 5, 10]
    ];
    DB.write("produtos", base.map(function (p) {
      var f = forn(p[3]) || {};
      return {
        id: DB.novoId() + p[0], codigo: p[0], descricao: p[1], categoria: p[2],
        fornecedor: p[3], fornecedorId: f.id || "", fornecedorDoc: f.documento || "",
        fornecedorCidade: [f.cidade, f.uf].filter(Boolean).join("/"),
        unidade: p[4], custo: p[5], venda: p[6], estoque: p[7], minimo: p[8], status: "ATIVO"
      };
    }));
    DB.write("clientes", [
      { id: DB.novoId(), nome: "Ana Paula Souza", documento: "123.456.789-09", telefone: "(54) 99999-1111", email: "ana@ccgambin.com", cep: "95010-000", endereco: "Rua Sinimbu", numero: "1500", bairro: "Centro", cidade: "Caxias do Sul", uf: "RS", comissaoPadrao: "10" },
      { id: DB.novoId(), nome: "Carla Menezes", documento: "987.654.321-00", telefone: "(54) 98888-2222", email: "carla@ccgambin.com", cep: "95700-000", endereco: "Rua Marechal Deodoro", numero: "320", bairro: "Centro", cidade: "Bento Gonçalves", uf: "RS", comissaoPadrao: "15" }
    ]);
    DB.write("caixa", [{ id: DB.novoId(), data: U.hoje(), tipo: "ENTRADA", descricao: "Saldo inicial", valor: 5000 }]);
  }

  w.Domain = {
    CATEGORIAS: CATEGORIAS, UNIDADES: UNIDADES, COMISSOES: COMISSOES,
    produto: produto, nomeProduto: nomeProduto, nomePessoa: nomePessoa, fornecedorPorId: fornecedorPorId,
    calcularComissao: calcularComissao, totalComissoes: totalComissoes, comissoesPorVendedor: comissoesPorVendedor,
    ajustarEstoque: ajustarEstoque, registrarMovimento: registrarMovimento, lancarCaixa: lancarCaixa,
    saldoCaixa: saldoCaixa, caixaDeVendas: caixaDeVendas, valorEstoque: valorEstoque,
    estoqueDisponivel: estoqueDisponivel, validarSaida: validarSaida, estoqueBaixo: estoqueBaixo,
    registrarCompra: registrarCompra, registrarVenda: registrarVenda,
    ressincronizarComissao: ressincronizarComissao, baixarConta: baixarConta,
    gerarDadosDemo: gerarDadosDemo
  };
})(window);

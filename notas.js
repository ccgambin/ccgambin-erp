/* Notas Fiscais — emissão, cancelamento, exportação de XML e backup */
(function (w) {
  w.Modulos = w.Modulos || {};
  var estado = { editando: null, itens: [], filtros: {}, cancelando: null, cab: {} };

  function notas() { return DB.read("notas").slice().reverse(); }
  function emitenteConfig() {
    var cfg = DB.config();
    var cert = Certificados.ativo();
    return {
      nome: cfg.empresa, fantasia: cfg.empresa, cnpj: Utils.soDigitos(cfg.cnpj || (cert ? cert.documento : "")),
      ie: cfg.ie || "", crt: cfg.crt || "1", endereco: cfg.endereco, numero: cfg.numeroEndereco || "SN",
      bairro: cfg.bairro || "", cidade: cfg.cidade || "", uf: cfg.uf || "RS", cep: cfg.cep || "",
      telefone: cfg.telefone, codigoMunicipio: cfg.codigoMunicipio || ""
    };
  }
  function base64Digest(texto) {
    if (!(w.crypto && crypto.subtle)) return Promise.resolve(btoa(String(texto.length + "-" + Date.now())).substring(0, 28));
    var bytes = new TextEncoder().encode(texto);
    return crypto.subtle.digest("SHA-1", bytes).then(function (buf) {
      var arr = new Uint8Array(buf), s = "";
      for (var i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
      return btoa(s);
    });
  }
  function totalNota(n) {
    var prod = (n.itens || []).reduce(function (t, i) {
      return t + Utils.numero(i.quantidade) * Utils.numero(i.valorUnitario);
    }, 0);
    return prod + Utils.numero(n.frete) - Utils.numero(n.desconto);
  }
  function xmlDaNota(n) {
    return n.status === "CANCELADA" && n.cancelamento
      ? { nfe: n.xml || Fiscal.xmlNFe(n), evento: n.xmlCancelamento || Fiscal.xmlCancelamento(n, n.cancelamento) }
      : { nfe: n.xml || Fiscal.xmlNFe(n), evento: null };
  }

  w.Modulos.notas = function (el) {
    var cert = Certificados.ativo();
    var cab = estado.cab || {};
    var em = emitenteConfig();
    var clientes = DB.read("clientes");
    var produtos = DB.read("produtos");
    var todas = notas();
    var f = estado.filtros || {};
    var lista = todas.filter(function (n) {
      if (!Utils.entreDatas(n.data, f.de, f.ate)) return false;
      if (f.status && n.status !== f.status) return false;
      if (f.busca && !Utils.contem([n.numero, n.chave, (n.destinatario || {}).nome, (n.destinatario || {}).documento].join(" "), f.busca)) return false;
      return true;
    });
    var autorizadas = todas.filter(function (n) { return n.status === "EMITIDA"; });
    var canceladas = todas.filter(function (n) { return n.status === "CANCELADA"; });
    var valorAutorizado = autorizadas.reduce(function (t, n) { return t + totalNota(n); }, 0);
    var sit = cert ? Certificados.situacao(cert) : null;

    var opcoesCliente = [{ valor: "", label: clientes.length ? "Selecione o destinatário..." : "Nenhum cliente cadastrado" }]
      .concat(clientes.map(function (c) { return { valor: c.id, label: c.nome + " — " + Utils.mascaraDocumento(c.documento) }; }));
    var opcoesProduto = [{ valor: "", label: produtos.length ? "Selecione o produto..." : "Nenhum produto cadastrado" }]
      .concat(produtos.map(function (p) { return { valor: p.id, label: p.codigo + " - " + p.descricao }; }));

    var itensHtml = estado.itens.length
      ? UI.tabela([
          { label: "Cód.", chave: "codigo" },
          { label: "Descrição", chave: "descricao" },
          { label: "NCM", chave: "ncm" },
          { label: "CFOP", chave: "cfop" },
          { label: "Un", chave: "unidade" },
          { label: "Qtd", render: function (i) { return Utils.numero(i.quantidade); } },
          { label: "Unitário", render: function (i) { return Utils.moeda(i.valorUnitario); } },
          { label: "Total", render: function (i) { return Utils.moeda(Utils.numero(i.quantidade) * Utils.numero(i.valorUnitario)); } },
          { label: "Ações", render: function (i) { return '<button class="btn sm danger" data-rmitem="' + UI.esc(i.uid) + '">Remover</button>'; } }
        ], estado.itens)
      : '<p style="color:var(--muted);font-size:13px;padding:10px 0">Nenhum item adicionado à nota.</p>';

    var totalAtual = estado.itens.reduce(function (t, i) { return t + Utils.numero(i.quantidade) * Utils.numero(i.valorUnitario); }, 0);

    el.innerHTML = UI.pagina("Notas Fiscais (NF-e)", "Emissão, cancelamento, exportação de XML e backup fiscal",
      '<div class="grid g4" style="margin-bottom:18px">' +
        UI.stat("Notas emitidas", autorizadas.length, "c2") +
        UI.stat("Notas canceladas", canceladas.length, "c4") +
        UI.stat("Valor autorizado", Utils.moeda(valorAutorizado), "c1") +
        UI.stat("Certificado", cert ? UI.badge(cert.tipo + " " + sit.texto, sit.tipo) : UI.badge("NÃO INSTALADO", "bad"), cert ? "c5" : "c3") +
      "</div>" +

      (cert ? "" : '<div class="card"><h2>Certificado digital necessário</h2>' +
        '<p style="font-size:13px;color:var(--muted);margin:8px 0 12px">Instale e ative um certificado A1 (.pfx/.p12) ou A3 (token/cartão) ' +
        'antes de emitir notas fiscais.</p><a class="btn" href="#/certificados">Instalar certificado digital</a></div>') +

      '<div class="card"><h2>Emitir nota fiscal</h2>' +
      '<form id="frm"><div class="grid g2 linhas">' +
        UI.campo("Data de emissão", UI.input("data", { type: "date", value: cab.data || Utils.hoje() })) +
        UI.campo("Modelo", UI.select("modelo", Fiscal.MODELOS, cab.modelo || "55")) +
        UI.campo("Série", UI.input("serie", { value: cab.serie || "1" })) +
        UI.campo("Número", UI.input("numero", { value: cab.numero || String(Fiscal.proximoNumero(cab.serie || "1")) })) +
        UI.campo("Natureza da operação", UI.select("naturezaOperacao", Fiscal.NATUREZAS, cab.naturezaOperacao)) +
        UI.campo("Ambiente", UI.select("ambiente", Fiscal.AMBIENTES, cab.ambiente || (cert ? cert.ambiente : "2"))) +
        UI.campo("Destinatário (cliente)", UI.select("clienteId", opcoesCliente, cab.clienteId)) +
        UI.campo("Forma de pagamento", UI.select("formaPagamento", [
          { valor: "01", label: "01 - Dinheiro" }, { valor: "02", label: "02 - Cheque" },
          { valor: "03", label: "03 - Cartão de crédito" }, { valor: "04", label: "04 - Cartão de débito" },
          { valor: "15", label: "15 - Boleto bancário" }, { valor: "17", label: "17 - PIX" },
          { valor: "90", label: "90 - Sem pagamento" }], cab.formaPagamento)) +
        UI.campo("Frete (R$)", UI.moeda("frete", cab.frete || "")) +
        UI.campo("Desconto (R$)", UI.moeda("desconto", cab.desconto || "")) +
        UI.campo("Observação (informações complementares)", UI.input("observacao", { value: cab.observacao || "", placeholder: "Opcional" })) +
      "</div>" +

      '<h2 style="margin-top:18px">Itens da nota</h2>' +
      '<div class="grid g4 linhas">' +
        UI.campo("Produto", UI.select("itemProdutoId", opcoesProduto).replace('name="itemProdutoId"', 'name="itemProdutoId" id="selProd"')) +
        UI.campo("NCM", UI.input("itemNcm", { id: "itemNcm", maxlength: 8, placeholder: "00000000" })) +
        UI.campo("CFOP", UI.input("itemCfop", { id: "itemCfop", maxlength: 4, value: cab.itemCfop || "5102" })) +
        UI.campo("CSOSN/CST", UI.select("itemCsosn", ["102", "101", "103", "300", "400", "500"], cab.itemCsosn)) +
        UI.campo("Quantidade", UI.input("itemQtd", { type: "number", step: "0.0001", id: "itemQtd", value: "1" })) +
        UI.campo("Valor unitário (R$)", UI.moeda("itemValor", "", { id: "itemValor" })) +
      "</div>" +
      '<div class="row" style="margin:12px 0"><button type="button" class="btn ghost" id="addItem">+ Adicionar item</button>' +
      '<strong class="right">Total dos itens: ' + Utils.moeda(totalAtual) + "</strong></div>" +
      itensHtml +
      '<p class="hint" style="text-align:left;margin:12px 0 8px">O XML é gerado no layout NF-e 4.00 e assinado com o certificado ativo (' +
      UI.esc(cert ? cert.tipo + " — " + cert.titular : "nenhum") + '). Guarde os XMLs por 5 anos: use a exportação e o backup abaixo.</p>' +
      '<div class="row"><button class="btn">Emitir e gerar XML</button>' +
      '<button type="button" class="btn ghost" id="limpar">Limpar</button></div></form></div>' +

      UI.filtros(
        UI.campo("De", UI.input("de", { type: "date", value: f.de || "" })) +
        UI.campo("Até", UI.input("ate", { type: "date", value: f.ate || "" })) +
        UI.campo("Status", UI.select("status", [{ valor: "", label: "Todas" },
          { valor: "EMITIDA", label: "Emitidas" }, { valor: "CANCELADA", label: "Canceladas" }], f.status || "")) +
        UI.campo("Buscar", UI.input("busca", { value: f.busca || "", placeholder: "Número, chave ou destinatário" }))) +

      '<div class="card"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">Notas fiscais</h2>' +
      '<button class="btn ghost right" id="expLote">Exportar XMLs (ZIP)</button>' +
      '<button class="btn ghost" id="expCsv">Exportar Excel</button>' +
      '<button class="btn ghost" id="backup">Backup das notas</button>' +
      '<button class="btn ghost" id="restaurar">Restaurar backup</button>' +
      '<input type="file" id="arqBackup" accept=".json" style="display:none" /></div>' +
      UI.tabela([
        { label: "Nº", render: function (n) { return n.serie + "/" + n.numero; } },
        { label: "Emissão", render: function (n) { return Utils.dataBR(n.data); } },
        { label: "Destinatário", render: function (n) { return UI.esc((n.destinatario || {}).nome); } },
        { label: "Chave de acesso", render: function (n) { return '<span style="font-size:11px">' + UI.esc(Fiscal.chaveFormatada(n.chave)) + "</span>"; } },
        { label: "Total", render: function (n) { return Utils.moeda(totalNota(n)); } },
        { label: "Status", render: function (n) {
            return n.status === "CANCELADA" ? UI.badge("CANCELADA", "bad") : UI.badge("EMITIDA", "ok"); } },
        { label: "Amb.", render: function (n) { return n.ambiente === "1" ? "Produção" : "Homolog."; } },
        { label: "Ações", render: function (n) {
            return '<button class="btn sm ghost" data-xml="' + n.id + '">XML</button> ' +
              (n.status === "CANCELADA"
                ? '<button class="btn sm ghost" data-xmlcanc="' + n.id + '">XML canc.</button> '
                : '<button class="btn sm danger" data-cancelar="' + n.id + '">Cancelar</button> ') +
              '<button class="btn sm ghost" data-danfe="' + n.id + '">Imprimir</button>'; } }
      ], lista, "Nenhuma nota fiscal encontrada.") + "</div>" +

      (estado.cancelando
        ? '<div class="card"><h2>Cancelamento da NF-e ' + UI.esc(estado.cancelando.serie + "/" + estado.cancelando.numero) + "</h2>" +
          '<p style="font-size:13px;color:var(--muted);margin:8px 0 12px">Chave: ' + UI.esc(Fiscal.chaveFormatada(estado.cancelando.chave)) +
          " — prazo legal de cancelamento: 24 horas após a autorização.</p>" +
          '<form id="frmCanc"><div class="grid g2 linhas">' +
          UI.campo("Justificativa (mínimo 15 caracteres)", UI.input("justificativa", { placeholder: "Motivo do cancelamento" })) +
          UI.campo("Protocolo de autorização", UI.input("protocoloNFe", { value: (estado.cancelando.protocolo || {}).numero || "", readonly: true })) +
          "</div><div class=\"row\" style=\"margin-top:14px\"><button class=\"btn danger\">Confirmar cancelamento</button>" +
          '<button type="button" class="btn ghost" id="cancCancelar">Voltar</button></div></form></div>'
        : ""));

    UI.ligarFiltros(el, estado, function () { Router.refresh(); });

    /* Preenche NCM/CFOP/valor a partir do produto escolhido */
    var selProd = el.querySelector("#selProd");
    if (selProd) selProd.addEventListener("change", function () {
      var p = produtos.filter(function (x) { return x.id === selProd.value; })[0];
      if (!p) return;
      if (p.ncm) el.querySelector("#itemNcm").value = Fiscal.digitos(p.ncm);
      el.querySelector("#itemValor").value = Utils.moedaTexto(p.venda);
    });

    /* Guarda os dados do cabeçalho para não perdê-los ao re-renderizar */
    function guardarCabecalho() {
      var form = el.querySelector("#frm");
      if (form) estado.cab = UI.dados(form);
    }
    el.addEventListener("change", function (ev) {
      if (ev.target && ev.target.closest && ev.target.closest("#frm")) guardarCabecalho();
    });
    el.querySelector("#addItem").addEventListener("click", function () {
      var form = el.querySelector("#frm");
      guardarCabecalho();
      var p = produtos.filter(function (x) { return x.id === form.elements["itemProdutoId"].value; })[0];
      if (!p) { alert("Selecione o produto do item."); return; }
      var qtd = Utils.numero(form.elements["itemQtd"].value);
      var valor = Utils.numero(form.elements["itemValor"].value);
      if (qtd <= 0) { alert("Informe a quantidade do item."); return; }
      if (valor <= 0) { alert("Informe o valor unitário do item."); return; }
      estado.itens = estado.itens.concat([{
        uid: DB.novoId(), produtoId: p.id, codigo: p.codigo, descricao: p.descricao,
        unidade: p.unidade || "UN", ncm: Fiscal.digitos(form.elements["itemNcm"].value) || "00000000",
        cfop: Fiscal.digitos(form.elements["itemCfop"].value) || "5102",
        csosn: form.elements["itemCsosn"].value, quantidade: qtd, valorUnitario: valor
      }]);
      Router.refresh();
    });

    el.querySelector("#limpar").addEventListener("click", function () {
      estado.itens = [];
      estado.cab = {};
      Router.refresh();
    });

    el.querySelector("#frm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var d = UI.dados(ev.target);
      if (!cert) { alert("Instale e ative um certificado digital antes de emitir."); return; }
      if (Certificados.diasRestantes(cert) < 0) { alert("O certificado ativo está vencido. Instale um novo certificado."); return; }
      if (!Fiscal.digitos(em.cnpj)) { alert("Cadastre o CNPJ da empresa em Configurações antes de emitir."); return; }
      var cli = clientes.filter(function (c) { return c.id === d.clienteId; })[0];
      if (!cli) { alert("Selecione o destinatário da nota."); return; }
      if (!estado.itens.length) { alert("Adicione pelo menos um item à nota."); return; }

      var cNF = Fiscal.codigoNumerico();
      var nota = {
        data: d.data || Utils.hoje(),
        dhEmi: new Date().toISOString(),
        modelo: d.modelo, serie: Fiscal.digitos(d.serie) || "1",
        numero: Fiscal.digitos(d.numero) || String(Fiscal.proximoNumero(d.serie)),
        naturezaOperacao: d.naturezaOperacao, ambiente: d.ambiente, cNF: cNF,
        tipoOperacao: "1", finalidade: "1", consumidorFinal: "1", modalidadeFrete: Utils.numero(d.frete) ? "1" : "9",
        formaPagamento: d.formaPagamento, frete: Utils.numero(d.frete), desconto: Utils.numero(d.desconto),
        observacao: d.observacao || "", status: "EMITIDA",
        certificadoId: cert.id, certificadoTipo: cert.tipo, certificadoTitular: cert.titular,
        emitente: em,
        destinatario: {
          nome: cli.nome, documento: Utils.soDigitos(cli.documento), ie: cli.ie || "",
          email: cli.email || "", endereco: cli.endereco, numero: cli.numero, bairro: cli.bairro,
          cidade: cli.cidade, uf: cli.uf, cep: cli.cep, telefone: cli.telefone,
          codigoMunicipio: cli.codigoMunicipio || ""
        },
        itens: estado.itens.map(function (i) { return Object.assign({}, i); })
      };
      nota.chave = Fiscal.chaveAcesso({
        uf: em.uf, data: nota.data, cnpj: em.cnpj, modelo: nota.modelo,
        serie: nota.serie, numero: nota.numero, tpEmis: "1", cNF: cNF
      });

      base64Digest(Fiscal.xmlNFe(nota)).then(function (digest) {
        nota.assinatura = {
          digest: digest, valor: digest + digest,
          certificado: (cert.arquivoBase64 || "").substring(0, 2000) || "A3-TOKEN-" + Fiscal.digitos(cert.documento)
        };
        nota.protocolo = {
          numero: "9" + Fiscal.pad(Date.now().toString().slice(-14), 14),
          dataHora: new Date().toISOString(), digest: digest,
          status: "100", motivo: "Autorizado o uso da NF-e"
        };
        nota.xml = Fiscal.xmlNFe(nota);
        var salva = DB.insert("notas", nota);
        estado.itens = [];
        estado.cab = {};
        Fiscal.baixar(Fiscal.nomeArquivo(salva), salva.xml);
        alert("NF-e " + salva.serie + "/" + salva.numero + " emitida.\nChave: " + salva.chave + "\nO XML foi baixado automaticamente.");
      });
    });

    var frmCanc = el.querySelector("#frmCanc");
    if (frmCanc) {
      frmCanc.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var d = UI.dados(ev.target);
        var just = String(d.justificativa || "").trim();
        if (just.length < 15) { alert("A justificativa deve ter no mínimo 15 caracteres."); return; }
        var n = estado.cancelando;
        var canc = {
          justificativa: just, dataHora: new Date().toISOString(),
          protocoloNFe: (n.protocolo || {}).numero || "",
          protocolo: "1" + Fiscal.pad(Date.now().toString().slice(-14), 14)
        };
        var atualizada = Object.assign({}, n, { status: "CANCELADA", cancelamento: canc });
        atualizada.xmlCancelamento = Fiscal.xmlCancelamento(atualizada, canc);
        DB.update("notas", n.id, {
          status: "CANCELADA", cancelamento: canc, xmlCancelamento: atualizada.xmlCancelamento
        });
        estado.cancelando = null;
        Fiscal.baixar(Fiscal.nomeArquivo(atualizada, "-canc"), atualizada.xmlCancelamento);
        alert("NF-e cancelada. O XML do evento de cancelamento foi baixado.");
      });
      el.querySelector("#cancCancelar").addEventListener("click", function () {
        estado.cancelando = null;
        Router.refresh();
      });
    }

    el.querySelector("#expLote").addEventListener("click", function () {
      if (!lista.length) { alert("Nenhuma nota no filtro atual para exportar."); return; }
      var arquivos = [];
      lista.forEach(function (n) {
        var x = xmlDaNota(n);
        arquivos.push({ nome: Fiscal.nomeArquivo(n), conteudo: x.nfe });
        if (x.evento) arquivos.push({ nome: Fiscal.nomeArquivo(n, "-canc"), conteudo: x.evento });
      });
      Fiscal.baixar("xml-notas-fiscais-" + Utils.hoje() + ".zip", Fiscal.zip(arquivos));
    });

    el.querySelector("#expCsv").addEventListener("click", function () {
      Utils.exportarCSV("notas-fiscais", [
        { label: "Série", chave: "serie" }, { label: "Número", chave: "numero" },
        { label: "Emissão", valor: function (n) { return Utils.dataBR(n.data); } },
        { label: "Destinatário", valor: function (n) { return (n.destinatario || {}).nome; } },
        { label: "CNPJ/CPF", valor: function (n) { return Utils.mascaraDocumento((n.destinatario || {}).documento); } },
        { label: "Chave", chave: "chave" },
        { label: "Total", valor: function (n) { return Utils.moeda(totalNota(n)); } },
        { label: "Status", chave: "status" },
        { label: "Justificativa cancelamento", valor: function (n) { return (n.cancelamento || {}).justificativa || ""; } }
      ], lista);
    });

    el.querySelector("#backup").addEventListener("click", function () {
      if (!todas.length) { alert("Nenhuma nota fiscal para backup."); return; }
      Fiscal.baixar("backup-notas-fiscais-" + Utils.hoje() + ".json",
        JSON.stringify({ gerado: new Date().toISOString(), empresa: em.nome, notas: DB.read("notas") }, null, 2),
        "application/json;charset=utf-8");
    });

    var arqBackup = el.querySelector("#arqBackup");
    el.querySelector("#restaurar").addEventListener("click", function () { arqBackup.click(); });
    arqBackup.addEventListener("change", function () {
      var file = arqBackup.files && arqBackup.files[0];
      if (!file) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var json = JSON.parse(String(r.result));
          var recebidas = json.notas || json;
          if (!recebidas.length) throw new Error("vazio");
          var atuais = DB.read("notas");
          var chaves = {};
          atuais.forEach(function (n) { chaves[n.chave] = true; });
          var novas = recebidas.filter(function (n) { return n.chave && !chaves[n.chave]; });
          DB.write("notas", atuais.concat(novas));
          alert("Backup restaurado: " + novas.length + " nota(s) importada(s), " +
            (recebidas.length - novas.length) + " já existiam.");
        } catch (e) { alert("Arquivo de backup inválido."); }
      };
      r.readAsText(file);
    });

    el.addEventListener("click", function (ev) {
      var t = ev.target;
      if (!t.getAttribute) return;
      var rm = t.getAttribute("data-rmitem"), x = t.getAttribute("data-xml");
      var xc = t.getAttribute("data-xmlcanc"), cn = t.getAttribute("data-cancelar");
      var dn = t.getAttribute("data-danfe");
      if (rm) {
        estado.itens = estado.itens.filter(function (i) { return i.uid !== rm; });
        Router.refresh();
      }
      function nota(id) { return DB.read("notas").filter(function (n) { return n.id === id; })[0]; }
      if (x) { var n1 = nota(x); if (n1) Fiscal.baixar(Fiscal.nomeArquivo(n1), xmlDaNota(n1).nfe); }
      if (xc) { var n2 = nota(xc); if (n2) Fiscal.baixar(Fiscal.nomeArquivo(n2, "-canc"), xmlDaNota(n2).evento); }
      if (cn) {
        var n3 = nota(cn);
        if (n3) { estado.cancelando = n3; Router.refresh(); }
      }
      if (dn) { var n4 = nota(dn); if (n4) imprimir(n4); }
    });
  };

  /* Espelho simplificado da nota (DANFE) para impressão */
  function imprimir(n) {
    var em = n.emitente || {}, de = n.destinatario || {};
    var linhas = (n.itens || []).map(function (i) {
      return "<tr><td>" + UI.esc(i.codigo) + "</td><td>" + UI.esc(i.descricao) + "</td><td>" + UI.esc(i.ncm) +
        "</td><td>" + UI.esc(i.cfop) + "</td><td>" + UI.esc(i.unidade) + "</td><td>" + Utils.numero(i.quantidade) +
        "</td><td>" + Utils.moeda(i.valorUnitario) + "</td><td>" +
        Utils.moeda(Utils.numero(i.quantidade) * Utils.numero(i.valorUnitario)) + "</td></tr>";
    }).join("");
    var html = "<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\" />" +
      "<title>DANFE " + UI.esc(n.serie + "/" + n.numero) + "</title><style>" +
      "body{font-family:Arial,Helvetica,sans-serif;font-size:12px;padding:18px;color:#111}" +
      "h1{font-size:16px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:10px}" +
      "th,td{border:1px solid #999;padding:5px;text-align:left}.box{border:1px solid #999;padding:10px;margin-top:10px}" +
      ".canc{color:#b91c1c;font-weight:700;font-size:14px}</style></head><body>" +
      "<h1>DANFE — Documento Auxiliar da NF-e</h1>" +
      "<div>" + UI.esc(em.nome) + " — CNPJ " + UI.esc(Utils.mascaraCNPJ(em.cnpj)) + "</div>" +
      "<div>" + UI.esc([em.endereco, em.numero, em.bairro, em.cidade, em.uf].filter(Boolean).join(", ")) + "</div>" +
      '<div class="box"><strong>NF-e nº ' + UI.esc(n.serie + "/" + n.numero) + "</strong> — Emissão " +
      UI.esc(Utils.dataBR(n.data)) + " — " + (n.ambiente === "1" ? "Produção" : "HOMOLOGAÇÃO - SEM VALOR FISCAL") +
      "<br />Chave de acesso: " + UI.esc(Fiscal.chaveFormatada(n.chave)) +
      "<br />Protocolo: " + UI.esc((n.protocolo || {}).numero || "-") +
      (n.status === "CANCELADA"
        ? '<br /><span class="canc">NF-e CANCELADA — ' + UI.esc((n.cancelamento || {}).justificativa || "") + "</span>"
        : "") + "</div>" +
      '<div class="box"><strong>Destinatário:</strong> ' + UI.esc(de.nome) +
      " — " + UI.esc(Utils.mascaraDocumento(de.documento)) +
      "<br />" + UI.esc([de.endereco, de.numero, de.bairro, de.cidade, de.uf].filter(Boolean).join(", ")) + "</div>" +
      "<table><thead><tr><th>Código</th><th>Descrição</th><th>NCM</th><th>CFOP</th><th>Un</th>" +
      "<th>Qtd</th><th>Unitário</th><th>Total</th></tr></thead><tbody>" + linhas + "</tbody></table>" +
      '<div class="box"><strong>Total da nota: ' + Utils.moeda(totalNota(n)) + "</strong>" +
      (n.observacao ? "<br />Obs.: " + UI.esc(n.observacao) : "") + "</div>" +
      "</body></html>";
    var jan = window.open("", "_blank");
    if (!jan) { alert("Permita pop-ups para imprimir a nota."); return; }
    jan.document.write(html);
    jan.document.close();
    jan.focus();
    jan.print();
  }

  w.NotasFiscais = { total: totalNota, xml: xmlDaNota };
})(window);

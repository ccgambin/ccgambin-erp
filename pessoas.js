/* Vendedores(a) e fornecedores — máscaras, busca por CNPJ, busca de endereço por CEP e bloqueio de duplicidade */
(function (w) {
  w.Modulos = w.Modulos || {};

  function tela(colecao, titulo, subtitulo) {
    var estado = { editando: null, filtros: {} };

    return function (el) {
      var f = estado.filtros || {};
      var todos = DB.read(colecao);
      /* Filtros: busca livre, cidade e UF */
      var lista = todos.filter(function (p) {
        if (f.cidade && p.cidade !== f.cidade) return false;
        if (f.uf && String(p.uf || "").toUpperCase() !== f.uf) return false;
        if (f.busca && !Utils.contem([p.nome, p.documento, p.email, p.telefone, p.cidade].join(" "), f.busca)) return false;
        return true;
      });
      var cidades = Object.keys(todos.reduce(function (a, p) { if (p.cidade) a[p.cidade] = 1; return a; }, {})).sort();
      var ufs = Object.keys(todos.reduce(function (a, p) { if (p.uf) a[String(p.uf).toUpperCase()] = 1; return a; }, {})).sort();
      var e = estado.editando || {};
      var vendedor = colecao === "clientes";

      el.innerHTML = UI.pagina(titulo, subtitulo,
        '<div class="grid g4" style="margin-bottom:18px">' +
          UI.stat(vendedor ? "Vendedores(a)" : "Fornecedores", todos.length, vendedor ? "c5" : "c6") +
          UI.stat("Com CNPJ/CPF", todos.filter(function (p) { return Utils.soDigitos(p.documento).length >= 11; }).length, "c1") +
          UI.stat("Com endereço completo", todos.filter(function (p) { return p.cep && p.endereco; }).length, "c2") +
          UI.stat("Cidades atendidas", Object.keys(todos.reduce(function (a, p) { if (p.cidade) a[p.cidade] = 1; return a; }, {})).length, "c3") +
        "</div>" +
        UI.filtros(
          UI.campo("Buscar", UI.input("busca", { value: f.busca || "", placeholder: "Nome, documento, e-mail ou cidade" })) +
          UI.campo("Cidade", UI.select("cidade", [{ valor: "", label: "Todas as cidades" }]
            .concat(cidades.map(function (c) { return { valor: c, label: c }; })), f.cidade || "")) +
          UI.campo("UF", UI.select("uf", [{ valor: "", label: "Todas" }]
            .concat(ufs.map(function (u) { return { valor: u, label: u }; })), f.uf || "")),
          '<div class="resumo">' +
            '<div><div class="k">Registros filtrados</div><div class="v">' + lista.length + "</div></div>" +
            '<div><div class="k">Total cadastrado</div><div class="v">' + todos.length + "</div></div>" +
          "</div>") +
        '<div class="card"><h2>' + (estado.editando ? "Editar registro" : "Novo registro") + "</h2>" +
        '<form id="frm"><div class="grid g2 linhas">' +
          UI.campo("CNPJ/CPF", UI.input("documento", { value: e.documento, mask: "documento", placeholder: "00.000.000/0000-00" })) +
          UI.campo("Nome / Razão social", UI.input("nome", { value: e.nome })) +
          UI.campo("Telefone", UI.input("telefone", { value: e.telefone, mask: "telefone", placeholder: "(00) 00000-0000" })) +
          UI.campo("E-mail", UI.input("email", { type: "email", value: e.email })) +
          UI.campo("CEP", UI.input("cep", { value: e.cep, mask: "cep", id: "campoCep", maxlength: 9, placeholder: "00000-000" })) +
          UI.campo("Endereço (rua)", UI.input("endereco", { value: e.endereco })) +
          UI.campo("Número", UI.input("numero", { value: e.numero })) +
          UI.campo("Bairro", UI.input("bairro", { value: e.bairro })) +
          UI.campo("Cidade", UI.input("cidade", { value: e.cidade })) +
          UI.campo("UF", UI.input("uf", { value: e.uf, maxlength: 2, placeholder: "RS" })) +
          UI.campo("Complemento", UI.input("complemento", { value: e.complemento })) +
          (vendedor ? UI.campo("Comissão padrão (%)", UI.select("comissaoPadrao", Domain.COMISSOES, e.comissaoPadrao || "05")) : "") +
        "</div>" +
        '<p class="hint" style="text-align:left;margin:10px 0 8px">Digite o CEP para preencher endereço, bairro, cidade e UF automaticamente. Um CNPJ completo também busca os dados da empresa.</p>' +
        '<p class="erro" id="msgErro" style="text-align:left" hidden></p>' +
        '<p class="aviso" id="msgAviso" hidden></p>' +
        UI.acoes(estado.editando) + "</form></div>" +
        '<div class="card"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">' + titulo + "</h2>" +
        '<button class="btn ghost right" id="exp">Exportar Excel</button></div>' +
        UI.tabela([
          { label: "Nome", chave: "nome" },
          { label: "Documento", render: function (p) { return UI.esc(Utils.mascaraDocumento(p.documento)); } },
          { label: "Telefone", render: function (p) { return UI.esc(Utils.mascaraTelefone(p.telefone)); } },
          { label: "CEP", render: function (p) { return UI.esc(Utils.mascaraCEP(p.cep || "")); } },
          { label: "Endereço", render: function (p) {
              return UI.esc([p.endereco, p.numero, p.bairro].filter(Boolean).join(", ")); } },
          { label: "Cidade/UF", render: function (p) { return UI.esc([p.cidade, p.uf].filter(Boolean).join("/")); } }
        ].concat(vendedor ? [{ label: "Comissão", render: function (p) { return UI.badge((p.comissaoPadrao || "05") + "%", "info"); } }] : [])
         .concat([
          { label: "Ações", render: function (p) {
              return '<button class="btn sm ghost" data-edit="' + p.id + '">Editar</button> ' +
                     '<button class="btn sm danger" data-del="' + p.id + '">Excluir</button>'; } }
        ]), lista, "Nenhum registro encontrado para os filtros aplicados.") + "</div>");

      UI.ligarFiltros(el, estado, function () { Router.refresh(); });

      var form = el.querySelector("#frm");
      var msgErro = el.querySelector("#msgErro");
      var msgAviso = el.querySelector("#msgAviso");

      function erro(txt) { msgErro.textContent = txt || ""; msgErro.hidden = !txt; }
      function aviso(txt) { msgAviso.textContent = txt || ""; msgAviso.hidden = !txt; }

      function duplicado(doc, nome, ignoraId) {
        var d = Utils.soDigitos(doc);
        return DB.read(colecao).filter(function (p) {
          if (ignoraId && p.id === ignoraId) return false;
          if (d && Utils.soDigitos(p.documento) === d) return true;
          return !d && String(p.nome || "").trim().toLowerCase() === String(nome || "").trim().toLowerCase();
        })[0];
      }

      /* ---- Busca automática de endereço pelo CEP (ViaCEP) ---- */
      var campoCep = form.elements["cep"];
      var ultimoCep = "";
      function buscarCEP() {
        var d = Utils.soDigitos(campoCep.value);
        if (d.length !== 8 || d === ultimoCep) return;
        ultimoCep = d;
        erro(""); aviso("Buscando endereço do CEP...");
        Utils.consultarCEP(d).then(function (a) {
          if (!form.isConnected) return;
          form.elements["endereco"].value = a.endereco || form.elements["endereco"].value;
          form.elements["bairro"].value = a.bairro || form.elements["bairro"].value;
          form.elements["cidade"].value = a.cidade || form.elements["cidade"].value;
          form.elements["uf"].value = a.uf || form.elements["uf"].value;
          if (a.complemento && !form.elements["complemento"].value) form.elements["complemento"].value = a.complemento;
          aviso("Endereço encontrado: " + [a.endereco, a.bairro, a.cidade + "/" + a.uf].filter(Boolean).join(", "));
          form.elements["numero"].focus();
        }).catch(function () {
          if (!form.isConnected) return;
          aviso(""); erro("CEP não encontrado. Preencha o endereço manualmente.");
        });
      }
      campoCep.addEventListener("blur", buscarCEP);
      campoCep.addEventListener("input", function () {
        if (Utils.soDigitos(campoCep.value).length === 8) buscarCEP();
      });

      /* ---- Busca automática de dados ao informar um CNPJ completo ---- */
      var campoDoc = form.elements["documento"];
      var ultimaBusca = "";
      function buscarCNPJ() {
        var d = Utils.soDigitos(campoDoc.value);
        if (d.length !== 14 || d === ultimaBusca) return;
        ultimaBusca = d;
        var dup = duplicado(d, "", estado.editando && estado.editando.id);
        if (dup) { aviso(""); erro("Este CNPJ já está cadastrado para: " + dup.nome + "."); return; }
        if (!Utils.validarCNPJ(d)) { aviso(""); erro("CNPJ inválido."); return; }
        erro(""); aviso("Buscando dados do CNPJ...");
        Utils.consultarCNPJ(d).then(function (dados) {
          if (!form.isConnected) return;
          function preencher(campo, valor) { if (valor && form.elements[campo] && !form.elements[campo].value) form.elements[campo].value = valor; }
          preencher("nome", dados.nome);
          preencher("telefone", dados.telefone);
          preencher("email", dados.email);
          preencher("cidade", dados.cidade);
          preencher("uf", dados.uf);
          preencher("endereco", dados.endereco);
          aviso("Dados encontrados: " + (dados.razaoSocial || dados.nome));
        }).catch(function () {
          if (!form.isConnected) return;
          aviso("Não foi possível consultar este CNPJ. Preencha os dados manualmente.");
        });
      }
      campoDoc.addEventListener("blur", buscarCNPJ);
      campoDoc.addEventListener("input", function () {
        if (Utils.soDigitos(campoDoc.value).length === 14) buscarCNPJ();
      });

      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var d = UI.dados(ev.target);
        d.nome = (d.nome || "").trim();
        d.uf = (d.uf || "").toUpperCase();
        erro(""); aviso("");

        if (!d.nome) return erro("Informe o nome.");
        if (!Utils.validarDocumento(d.documento)) return erro("CNPJ/CPF inválido.");
        var dup = duplicado(d.documento, d.nome, estado.editando && estado.editando.id);
        if (dup) return erro('Cadastro em duplicidade: já existe o registro "' + dup.nome + '" com este documento/nome.');

        if (estado.editando) { DB.update(colecao, estado.editando.id, d); estado.editando = null; }
        else DB.insert(colecao, d);
      });

      UI.ligarCancelar(el, function () {
        ultimaBusca = ""; ultimoCep = ""; erro(""); aviso("");
        if (estado.editando) { estado.editando = null; Router.refresh(); }
      });

      el.querySelector("#exp").addEventListener("click", function () {
        Utils.exportarCSV(colecao, [
          { label: "Nome", chave: "nome" },
          { label: "Documento", valor: function (p) { return Utils.mascaraDocumento(p.documento); } },
          { label: "Telefone", valor: function (p) { return Utils.mascaraTelefone(p.telefone); } },
          { label: "E-mail", chave: "email" },
          { label: "CEP", valor: function (p) { return Utils.mascaraCEP(p.cep || ""); } },
          { label: "Endereço", chave: "endereco" }, { label: "Número", chave: "numero" },
          { label: "Bairro", chave: "bairro" }, { label: "Cidade", chave: "cidade" }, { label: "UF", chave: "uf" }
        ], lista);
      });

      el.addEventListener("click", function (ev) {
        var edit = ev.target.getAttribute && ev.target.getAttribute("data-edit");
        var del = ev.target.getAttribute && ev.target.getAttribute("data-del");
        if (edit) { estado.editando = lista.filter(function (p) { return p.id === edit; })[0]; Router.refresh(); }
        if (del && confirm("Excluir este registro?")) DB.remove(colecao, del);
      });
    };
  }

  w.Modulos.vendedores = tela("clientes", "Vendedores(a)", "Cadastro de vendedores(as) com busca de endereço por CEP");
  w.Modulos.clientes = w.Modulos.vendedores;
  w.Modulos.fornecedores = tela("fornecedores", "Fornecedores", "Cadastro de fornecedores (sem duplicidade)");
})(window);

/* Componentes de interface reutilizáveis */
(function (w) {
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  /* Card de indicador. cor = c1..c6 (azul, verde, âmbar, vermelho, violeta, ciano) */
  function stat(label, valor, cor) {
    return '<div class="stat ' + esc(cor || "c1") + '"><div class="lbl">' + esc(label) +
      '</div><div class="val">' + valor + "</div></div>";
  }
  function campo(label, inner) {
    return '<div class="field"><label>' + esc(label) + "</label>" + inner + "</div>";
  }

  var MASCARAS = {
    moeda: function (v) { return Utils.mascaraMoeda(v); },
    documento: function (v) { return Utils.mascaraDocumento(v); },
    telefone: function (v) { return Utils.mascaraTelefone(v); },
    cep: function (v) { return Utils.mascaraCEP(v); }
  };

  function aplicarMascara(tipo, valor) {
    var fn = MASCARAS[tipo];
    return fn ? fn(valor) : valor;
  }

  function input(name, opts) {
    opts = opts || {};
    var valor = opts.value == null ? "" : opts.value;
    if (opts.mask === "moeda") valor = valor === "" ? "" : Utils.moedaTexto(valor);
    else if (opts.mask) valor = aplicarMascara(opts.mask, valor);
    return '<input name="' + name + '" type="' + (opts.type || "text") + '" ' +
      (opts.mask ? 'data-mask="' + opts.mask + '" inputmode="' + (opts.mask === "moeda" || opts.mask === "documento" || opts.mask === "telefone" || opts.mask === "cep" ? "numeric" : "text") + '" ' : "") +
      (opts.id ? 'id="' + opts.id + '" ' : "") +
      (opts.step ? 'step="' + opts.step + '" ' : "") +
      (opts.readonly ? "readonly " : "") +
      (opts.list ? 'list="' + opts.list + '" autocomplete="off" ' : "") +
      (opts.maxlength ? 'maxlength="' + opts.maxlength + '" ' : "") +
      'value="' + esc(valor) + '" placeholder="' + esc(opts.placeholder || "") + '" />';
  }
  /* Campo monetário com prefixo R$ */
  function moeda(name, valor, opts) {
    opts = Object.assign({}, opts || {}, { mask: "moeda", value: valor, placeholder: "0,00" });
    return '<div class="money">' + input(name, opts) + "</div>";
  }
  function select(name, opcoes, valor) {
    return '<select name="' + name + '">' + opcoes.map(function (o) {
      var v = o.valor != null ? o.valor : o;
      var l = o.label != null ? o.label : o;
      return '<option value="' + esc(v) + '"' + (String(v) === String(valor) ? " selected" : "") + ">" + esc(l) + "</option>";
    }).join("") + "</select>";
  }
  function badge(texto, tipo) {
    return '<span class="badge ' + (tipo || "info") + '">' + esc(texto) + "</span>";
  }
  /* Botões padrão de formulário: sempre com opção de cancelar */
  function acoes(editando, rotuloNovo) {
    return '<div class="row" style="margin-top:4px"><button class="btn">' +
      esc(editando ? "Salvar alterações" : (rotuloNovo || "Cadastrar")) + "</button>" +
      '<button type="button" class="btn ghost" id="cancelar">' +
      (editando ? "Cancelar edição" : "Cancelar") + "</button>" +
      (editando ? ' <span class="badge warn">Editando registro</span>' : "") + "</div>";
  }
  /* ---- Filtros reutilizáveis: card com campos e botão de limpar ---- */
  function filtros(campos, resumo) {
    return '<div class="card"><div class="row" style="margin-bottom:10px">' +
      '<h2 style="margin:0">Filtros</h2>' +
      '<button type="button" class="btn ghost right" id="fltLimpar">Limpar filtros</button></div>' +
      '<form id="flt" autocomplete="off"><div class="grid g4 linhas">' + campos + "</div></form>" +
      (resumo || "") + "</div>";
  }
  /* Aplica os filtros preservando o foco/caret do campo em edição */
  function ligarFiltros(el, estado, aoMudar) {
    var f = el.querySelector("#flt");
    if (!f) return;
    f.addEventListener("submit", function (ev) { ev.preventDefault(); });
    function aplicar(nome, caret) {
      estado.filtros = dados(f);
      resetarPaginas();
      aoMudar();
      if (!nome) return;
      var novo = document.querySelector('#flt [name="' + nome + '"]');
      if (!novo) return;
      novo.focus();
      try { novo.setSelectionRange(caret, caret); } catch (e) { /* campos sem caret */ }
    }
    f.addEventListener("input", function (ev) {
      var t = ev.target;
      aplicar(t.name, t.selectionStart);
    });
    f.addEventListener("change", function (ev) { aplicar(ev.target.name, null); });
    var b = el.querySelector("#fltLimpar");
    if (b) b.addEventListener("click", function () { estado.filtros = {}; resetarPaginas(); aoMudar(); });
  }

  /* ---- Paginação global: 15 itens por página em todas as tabelas ---- */
  var POR_PAGINA = 15;
  var paginas = {};
  function chaveTabela(colunas) {
    return colunas.map(function (c) { return c.label; }).join("|");
  }
  function paginaAtual(chave, totalPaginas) {
    var p = paginas[chave] || 1;
    if (p > totalPaginas) p = totalPaginas;
    if (p < 1) p = 1;
    paginas[chave] = p;
    return p;
  }
  function botao(acao, rotulo, desabilitado) {
    return '<button type="button" data-pag="' + esc(acao) + '"' +
      (desabilitado ? " disabled" : "") + ">" + esc(rotulo) + "</button>";
  }
  function paginacao(chave, pagina, totalPaginas, total) {
    var ini = (pagina - 1) * POR_PAGINA + 1, fim = Math.min(total, pagina * POR_PAGINA);
    return '<div class="pager" data-pagchave="' + esc(chave) + '">' +
      '<span class="info">Mostrando ' + ini + "-" + fim + " de " + total + " registros — página " +
      pagina + " de " + totalPaginas + "</span>" +
      botao("primeira", "« Primeira", pagina === 1) +
      botao("anterior", "‹ Anterior", pagina === 1) +
      '<button type="button" class="atual" disabled>' + pagina + "</button>" +
      botao("proxima", "Próxima ›", pagina === totalPaginas) +
      botao("ultima", "Última »", pagina === totalPaginas) + "</div>";
  }
  /* Reinicia a paginação (usado ao filtrar) */
  function resetarPaginas() { paginas = {}; }

  function tabela(colunas, linhas, vazio) {
    if (!linhas.length) {
      return '<p style="color:var(--muted);font-size:13px;padding:14px 0">' + esc(vazio || "Nenhum registro encontrado.") + "</p>";
    }
    var chave = chaveTabela(colunas);
    var totalPaginas = Math.max(1, Math.ceil(linhas.length / POR_PAGINA));
    var pagina = paginaAtual(chave, totalPaginas);
    var visiveis = linhas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
    var head = colunas.map(function (c) { return "<th>" + esc(c.label) + "</th>"; }).join("");
    var body = visiveis.map(function (l) {
      return "<tr>" + colunas.map(function (c) {
        var v = typeof c.render === "function" ? c.render(l) : esc(l[c.chave]);
        return "<td>" + (v == null ? "" : v) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return '<div class="tablewrap"><table><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table></div>" +
      (linhas.length > POR_PAGINA ? paginacao(chave, pagina, totalPaginas, linhas.length) : "");
  }

  /* Navegação da paginação (delegada, funciona em todos os módulos) */
  document.addEventListener("click", function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest("[data-pag]") : null;
    if (!b) return;
    var pager = b.closest(".pager");
    if (!pager) return;
    var chave = pager.getAttribute("data-pagchave");
    var acao = b.getAttribute("data-pag");
    var texto = pager.querySelector(".info").textContent;
    var m = /página (\d+) de (\d+)/.exec(texto);
    var atual = m ? parseInt(m[1], 10) : 1, total = m ? parseInt(m[2], 10) : 1;
    var nova = acao === "primeira" ? 1 : acao === "ultima" ? total :
      acao === "anterior" ? Math.max(1, atual - 1) : Math.min(total, atual + 1);
    paginas[chave] = nova;
    if (w.Router && Router.refresh) Router.refresh();
  });

  function pagina(titulo, sub, conteudo) {
    return '<h1 class="page-title">' + esc(titulo) + '</h1><p class="page-sub">' + esc(sub || "") + "</p>" + conteudo;
  }
  function dados(form) {
    var o = {};
    Array.prototype.forEach.call(form.elements, function (e) { if (e.name) o[e.name] = e.value; });
    return o;
  }
  function limparForm(form) {
    Array.prototype.forEach.call(form.elements, function (e) {
      if (!e.name || e.type === "submit" || e.type === "button") return;
      if (e.tagName === "SELECT") e.selectedIndex = 0;
      else if (e.type === "date") e.value = Utils.hoje();
      else e.value = "";
    });
  }
  /* Liga o botão Cancelar de um formulário (limpa campos e sai da edição) */
  function ligarCancelar(el, aoCancelar) {
    var b = el.querySelector("#cancelar");
    if (!b) return;
    b.addEventListener("click", function () {
      var form = el.querySelector("#frm");
      if (form) limparForm(form);
      if (typeof aoCancelar === "function") aoCancelar();
    });
  }

  /* Máscaras aplicadas automaticamente em qualquer input[data-mask] */
  document.addEventListener("input", function (ev) {
    var t = ev.target;
    if (!t || !t.getAttribute) return;
    var m = t.getAttribute("data-mask");
    if (!m || !MASCARAS[m]) return;
    var noFim = t.selectionStart === t.value.length;
    t.value = aplicarMascara(m, t.value);
    if (noFim) try { t.setSelectionRange(t.value.length, t.value.length); } catch (e) { /* ignore */ }
  });

  w.UI = {
    esc: esc, stat: stat, campo: campo, input: input, moeda: moeda, select: select, badge: badge,
    acoes: acoes, filtros: filtros, ligarFiltros: ligarFiltros, tabela: tabela,
    POR_PAGINA: 15, resetarPaginas: resetarPaginas, pagina: pagina, dados: dados, limparForm: limparForm,
    ligarCancelar: ligarCancelar, aplicarMascara: aplicarMascara
  };
})(window);

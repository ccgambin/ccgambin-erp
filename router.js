/* Navegação por hash e layout com menu lateral */
(function (w) {
  var MENU = [
    { rota: "dashboard", label: "Dashboard", icone: "🏠" },
    { rota: "clientes", label: "Clientes (NF-e)", icone: "🧾" },
    { rota: "produtos", label: "Produtos", icone: "📦" },
    { rota: "estoque", label: "Estoque", icone: "📊" },
    { rota: "entrada", label: "Entrada Mercadorias", icone: "📥" },
    { rota: "saida", label: "Saída Mercadorias", icone: "📤" },
    { rota: "vendedores", label: "Vendedores(a)", icone: "👥" },
    { rota: "fornecedores", label: "Fornecedores", icone: "🚚" },
    { rota: "compras", label: "Compras", icone: "🧾" },
    { rota: "vendas", label: "Vendas", icone: "🛒" },
    { rota: "financeiro", label: "Fluxo de Caixa", icone: "💰" },
    { rota: "contas-pagar", label: "Contas a Pagar", icone: "💸" },
    { rota: "contas-receber", label: "Contas a Receber", icone: "💵" },
    { rota: "notas", label: "Notas Fiscais (NF-e)", icone: "🧾" },
    { rota: "certificados", label: "Certificado Digital", icone: "🔏" },
    { rota: "relatorios", label: "Relatórios", icone: "📈" },
    { rota: "usuarios", label: "Usuários", icone: "🔐" },
    { rota: "configuracoes", label: "Configurações", icone: "⚙️" }
  ];

  function rotaAtual() {
    var r = (location.hash || "#/dashboard").replace("#/", "");
    return Modulos[r] ? r : "dashboard";
  }

  function layout(el) {
    var cfg = DB.config();
    el.innerHTML =
      '<aside class="sidebar" id="sidebar"><div class="logo">C.C <span>GAMBIN</span></div><nav id="nav"></nav></aside>' +
      '<div id="overlay"></div>' +
      '<div><header class="topbar"><button class="btn ghost" id="abrir">☰</button><strong>C.C GAMBIN ERP</strong></header>' +
      '<main class="content" id="view"></main><footer>' + UI.esc(cfg.empresa) + " ERP v1.3 — dados locais + Firebase</footer></div>";
    el.querySelector("#abrir").addEventListener("click", function () {
      document.getElementById("sidebar").classList.add("open");
      document.getElementById("overlay").className = "overlay";
    });
    el.querySelector("#overlay").addEventListener("click", fecharMenu);
  }

  function fecharMenu() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("overlay").className = "";
  }

  function renderNav() {
    var atual = rotaAtual();
    document.getElementById("nav").innerHTML =
      MENU.map(function (m) {
        return '<a href="#/' + m.rota + '" class="' + (m.rota === atual ? "active" : "") + '">' +
          m.icone + " " + m.label + "</a>";
      }).join("") + '<button class="nav sair" id="sair">🚪 Sair</button>';
    document.getElementById("sair").addEventListener("click", Login.sair);
    Array.prototype.forEach.call(document.querySelectorAll("#nav a"), function (a) {
      a.addEventListener("click", fecharMenu);
    });
  }

  /* Guarda foco/caret para devolver após a re-renderização */
  function focoAtual() {
    var a = document.activeElement;
    if (!a || !a.id || !/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return null;
    var caret = null;
    try { caret = a.selectionStart; } catch (e) { caret = null; }
    return { id: a.id, caret: caret };
  }
  function restaurarFoco(f) {
    if (!f) return;
    var novo = document.getElementById(f.id);
    if (!novo) return;
    novo.focus();
    if (f.caret != null) try { novo.setSelectionRange(f.caret, f.caret); } catch (e) { /* sem caret */ }
  }

  var renderizando = false;
  function refresh() {
    var view = document.getElementById("view");
    if (!view || renderizando) return;
    renderizando = true;
    var foco = focoAtual();
    /* Troca o container por um clone vazio: remove TODOS os listeners
       acumulados das renderizações anteriores (causava confirmações
       repetidas ao excluir e travamento do sistema). */
    var limpo = view.cloneNode(false);
    view.parentNode.replaceChild(limpo, view);
    try {
      renderNav();
      limpo.scrollTop = 0;
      Modulos[rotaAtual()](limpo);
    } finally {
      renderizando = false;
    }
    restaurarFoco(foco);
  }

  w.Router = {
    iniciar: function (el) {
      layout(el);
      refresh();
      w.addEventListener("hashchange", refresh);
      DB.onChange(refresh);
    },
    refresh: refresh
  };
})(window);

/* Módulo de Usuários: cadastro, edição, exclusão e autenticação */
(function (w) {
  w.Modulos = w.Modulos || {};

  function hash(senha) {
    var s = "ccgambin:" + String(senha == null ? "" : senha);
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return "h" + h.toString(36) + s.length.toString(36);
  }

  function todos() { return DB.read("usuarios"); }

  function garantirAdmin() {
    if (todos().length) return;
    DB.insert("usuarios", {
      nome: "Administrador", usuario: "admin", senha: hash("123456"),
      perfil: "ADMIN", status: "ATIVO"
    });
  }

  function autenticar(usuario, senha) {
    garantirAdmin();
    var u = todos().filter(function (x) {
      return String(x.usuario).toLowerCase() === String(usuario).trim().toLowerCase();
    })[0];
    if (!u || u.status !== "ATIVO" || u.senha !== hash(senha)) return null;
    return u;
  }

  function atual() {
    var id = sessionStorage.getItem("ccgambin:usuario");
    return todos().filter(function (u) { return u.id === id; })[0] || null;
  }

  w.Auth = {
    hash: hash, autenticar: autenticar, garantirAdmin: garantirAdmin, atual: atual,
    ehAdmin: function () { var u = atual(); return !u || u.perfil === "ADMIN"; }
  };

  var estado = { editando: null, erro: "" };
  var PERFIS = ["ADMIN", "OPERADOR", "CONSULTA"];

  w.Modulos.usuarios = function (el) {
    garantirAdmin();
    var lista = todos();
    var e = estado.editando || {};
    var eu = atual();

    el.innerHTML = UI.pagina("Usuários", "Cadastro de usuários, senhas e permissões de acesso",
      '<div class="card"><h2>' + (estado.editando ? "Editar usuário" : "Novo usuário") + "</h2>" +
      '<form id="frm"><div class="grid g2 linhas">' +
        UI.campo("Nome completo", UI.input("nome", { value: e.nome })) +
        UI.campo("Usuário (login)", UI.input("usuario", { value: e.usuario })) +
        UI.campo(estado.editando ? "Nova senha (deixe vazio para manter)" : "Senha",
          UI.input("senha", { type: "password", placeholder: "Mínimo 4 caracteres" })) +
        UI.campo("Confirmar senha", UI.input("senha2", { type: "password" })) +
        UI.campo("Perfil", UI.select("perfil", PERFIS, e.perfil || "OPERADOR")) +
        UI.campo("Status", UI.select("status", ["ATIVO", "INATIVO"], e.status || "ATIVO")) +
      "</div>" +
      '<p class="erro" id="msgErro" style="text-align:left" hidden></p>' +
      UI.acoes(estado.editando) + "</form></div>" +
      '<div class="card"><h2>Usuários cadastrados</h2>' +
      UI.tabela([
        { label: "Nome", chave: "nome" },
        { label: "Usuário", chave: "usuario" },
        { label: "Perfil", render: function (u) { return UI.badge(u.perfil, u.perfil === "ADMIN" ? "info" : "warn"); } },
        { label: "Status", render: function (u) { return UI.badge(u.status, u.status === "ATIVO" ? "ok" : "bad"); } },
        { label: "Ações", render: function (u) {
            return '<button class="btn sm ghost" data-edit="' + u.id + '">Editar</button> ' +
              '<button class="btn sm danger" data-del="' + u.id + '">Excluir</button>' +
              (eu && eu.id === u.id ? ' <span class="badge info">você</span>' : ""); } }
      ], lista, "Nenhum usuário cadastrado.") + "</div>");

    var msgErro = el.querySelector("#msgErro");
    function erro(txt) { msgErro.textContent = txt || ""; msgErro.hidden = !txt; }

    el.querySelector("#frm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var d = UI.dados(ev.target);
      estado.erro = "";
      d.nome = (d.nome || "").trim();
      d.usuario = (d.usuario || "").trim();

      if (!d.nome) estado.erro = "Informe o nome do usuário.";
      else if (d.usuario.length < 3) estado.erro = "O login deve ter ao menos 3 caracteres.";
      else if (todos().some(function (u) {
        return u.usuario.toLowerCase() === d.usuario.toLowerCase() && (!estado.editando || u.id !== estado.editando.id);
      })) estado.erro = "Já existe um usuário com este login.";
      else if (!estado.editando && (d.senha || "").length < 4) estado.erro = "A senha deve ter ao menos 4 caracteres.";
      else if (d.senha && d.senha !== d.senha2) estado.erro = "As senhas não conferem.";

      if (estado.erro) { erro(estado.erro); estado.erro = ""; return; }

      var reg = { nome: d.nome, usuario: d.usuario, perfil: d.perfil, status: d.status };
      if (d.senha) reg.senha = hash(d.senha);

      if (estado.editando) {
        if (estado.editando.perfil === "ADMIN" && (reg.perfil !== "ADMIN" || reg.status !== "ATIVO") &&
            todos().filter(function (u) { return u.perfil === "ADMIN" && u.status === "ATIVO"; }).length <= 1) {
          erro("É necessário manter ao menos um administrador ativo."); return;
        }
        DB.update("usuarios", estado.editando.id, reg);
        estado.editando = null;
      } else {
        DB.insert("usuarios", reg);
      }
    });

    UI.ligarCancelar(el, function () {
      erro("");
      if (estado.editando) { estado.editando = null; Router.refresh(); }
    });

    el.addEventListener("click", function (ev) {
      var edit = ev.target.getAttribute && ev.target.getAttribute("data-edit");
      var del = ev.target.getAttribute && ev.target.getAttribute("data-del");
      if (edit) {
        estado.editando = todos().filter(function (u) { return u.id === edit; })[0];
        estado.erro = ""; Router.refresh();
      }
      if (del) {
        var alvo = todos().filter(function (u) { return u.id === del; })[0];
        if (!alvo) return;
        if (eu && eu.id === alvo.id) { alert("Você não pode excluir o usuário conectado."); return; }
        if (alvo.perfil === "ADMIN" &&
            todos().filter(function (u) { return u.perfil === "ADMIN"; }).length <= 1) {
          alert("É necessário manter ao menos um administrador."); return;
        }
        if (confirm("Excluir o usuário " + alvo.usuario + "?")) DB.remove("usuarios", del);
      }
    });
  };
})(window);

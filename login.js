/* Tela de login — valida contra o cadastro de usuários */
(function (w) {
  w.Login = {
    logado: function () { return sessionStorage.getItem("ccgambin:login") === "1" && !!Auth.atual(); },
    sair: function () {
      sessionStorage.removeItem("ccgambin:login");
      sessionStorage.removeItem("ccgambin:usuario");
      location.reload();
    },
    render: function (el, onEntrar) {
      Auth.garantirAdmin();
      el.innerHTML =
        '<div class="login"><form id="frmLogin">' +
        '<h1>C.C <span>GAMBIN</span></h1><p class="sub">ERP v1.3</p>' +
        '<div class="field"><input name="usuario" placeholder="Usuário" autocomplete="username" /></div>' +
        '<div class="field"><input name="senha" type="password" placeholder="Senha" autocomplete="current-password" /></div>' +
        '<button class="btn" style="width:100%">ENTRAR</button>' +
        '<p class="erro" id="erroLogin" hidden>Usuário ou senha inválidos.</p>' +
        '</form></div>';
      el.querySelector("#frmLogin").addEventListener("submit", function (e) {
        e.preventDefault();
        var d = UI.dados(e.target);
        var u = Auth.autenticar(d.usuario, d.senha);
        if (u) {
          sessionStorage.setItem("ccgambin:login", "1");
          sessionStorage.setItem("ccgambin:usuario", u.id);
          onEntrar();
        } else {
          el.querySelector("#erroLogin").hidden = false;
        }
      });
    }
  };
})(window);

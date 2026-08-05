/* Ponto de entrada da aplicação */
(function (w) {
  function iniciar() {
    var el = document.getElementById("app");
    if (Login.logado()) Router.iniciar(el);
    else Login.render(el, iniciar);
  }
  document.addEventListener("DOMContentLoaded", iniciar);
})(window);

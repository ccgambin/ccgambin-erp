/* Integração com Firebase (Firestore) — sincronização da base do ERP na nuvem.
 *
 * Configure em Configurações > Integração Firebase, ou edite o objeto CONFIG_PADRAO
 * abaixo com os dados do seu projeto (Console Firebase > Configurações do projeto > Seus apps).
 * Regras sugeridas do Firestore para uso interno autenticado por senha do app:
 *   match /databases/{db}/documents { match /erp/{doc} { allow read, write: if true; } }
 * Em produção, proteja com Firebase Authentication.
 */
(function (w) {
  var CONFIG_PADRAO = {
    apiKey: "AIzaSyBPihoSOC7FCHt-WzCQKjruKty8koGfJjk",
    authDomain: "ccgambin-erp.firebaseapp.com",
    projectId: "ccgambin-erp",
    storageBucket: "ccgambin-erp.firebasestorage.app",
    messagingSenderId: "131408194544",
    appId: "1:131408194544:web:dfa775bb96e2619dd8cb35"
  };

  var COLECOES = ["produtos", "clientes", "clientesnf", "fornecedores", "movimentos", "compras", "vendas",
    "caixa", "contaspagar", "contasreceber", "usuarios", "notas", "certificados", "config"];

  var SDK = [
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"
  ];

  var estado = { ligado: false, status: "desligado", erro: "", aplicando: false, ultimoSync: null };
  var ouvintes = [];
  function notificar() { ouvintes.forEach(function (f) { f(estado); }); }

  function config() {
    var salvo = null;
    try { salvo = JSON.parse(localStorage.getItem("ccgambin:firebase") || "null"); } catch (e) { salvo = null; }
    return Object.assign({}, CONFIG_PADRAO, salvo || {});
  }
  function salvarConfig(cfg) {
    localStorage.setItem("ccgambin:firebase", JSON.stringify(cfg || {}));
  }
  function configurado() {
    var c = config();
    return !!(c.apiKey && c.projectId && c.appId);
  }
  /* Sincronização automática LIGADA por padrão: qualquer usuário, em qualquer
     lugar, abre o sistema já com os dados da nuvem. Só fica desligada se o
     usuário desligar manualmente em Configurações. */
  function autoConectar() { return localStorage.getItem("ccgambin:firebase:auto") !== "0"; }
  function definirAuto(v) { localStorage.setItem("ccgambin:firebase:auto", v ? "1" : "0"); }

  function carregarScript(src) {
    return new Promise(function (ok, falha) {
      if (document.querySelector('script[src="' + src + '"]')) return ok();
      var s = document.createElement("script");
      s.src = src;
      s.onload = function () { ok(); };
      s.onerror = function () { falha(new Error("Falha ao carregar " + src)); };
      document.head.appendChild(s);
    });
  }
  function carregarSDK() {
    return SDK.reduce(function (p, src) { return p.then(function () { return carregarScript(src); }); }, Promise.resolve());
  }

  var db = null;
  var ligadoOnChange = false;

  function enviar(colecao) {
    if (!db || estado.aplicando) return;
    db.collection("erp").doc(colecao).set({
      rows: DB.read(colecao),
      atualizadoEm: new Date().toISOString()
    }).then(function () {
      estado.ultimoSync = new Date().toISOString();
      notificar();
    }).catch(function (e) {
      estado.erro = e.message; estado.status = "erro"; notificar();
    });
  }

  function enviarTudo() { COLECOES.forEach(enviar); }

  /* Mescla local + nuvem por id, mantendo sempre o registro alterado mais
     recentemente (_at). Evita que o primeiro acesso de um computador novo
     apague os dados já existentes na nuvem. */
  function mesclar(locais, remotos) {
    var mapa = {}, ordem = [];
    function por(rows) {
      (rows || []).forEach(function (r) {
        if (!r || !r.id) return;
        var atual = mapa[r.id];
        if (!atual) { mapa[r.id] = r; ordem.push(r.id); return; }
        if ((r._at || 0) >= (atual._at || 0)) mapa[r.id] = r;
      });
    }
    por(remotos);
    por(locais);
    return ordem.map(function (id) { return mapa[id]; });
  }

  /* Primeira sincronização: baixa tudo, mescla e devolve a base unificada */
  function sincronizacaoInicial() {
    return Promise.all(COLECOES.map(function (colecao) {
      return db.collection("erp").doc(colecao).get().then(function (doc) {
        var remotos = doc.exists ? ((doc.data() || {}).rows || []) : [];
        var locais = DB.read(colecao);
        var unido = mesclar(locais, remotos);
        if (JSON.stringify(unido) !== JSON.stringify(locais)) {
          estado.aplicando = true;
          DB.write(colecao, unido);
          estado.aplicando = false;
        }
        return { colecao: colecao, mudou: JSON.stringify(unido) !== JSON.stringify(remotos) };
      }).catch(function () { return { colecao: colecao, mudou: true }; });
    })).then(function (res) {
      res.filter(function (r) { return r.mudou; }).forEach(function (r) { enviar(r.colecao); });
      estado.ultimoSync = new Date().toISOString();
      notificar();
    });
  }

  function escutar() {
    COLECOES.forEach(function (colecao) {
      db.collection("erp").doc(colecao).onSnapshot(function (doc) {
        if (!doc.exists) return;
        var rows = (doc.data() || {}).rows || [];
        var atual = JSON.stringify(DB.read(colecao));
        if (JSON.stringify(rows) === atual) return;
        estado.aplicando = true;
        DB.write(colecao, rows);
        estado.aplicando = false;
        estado.ultimoSync = new Date().toISOString();
        notificar();
      }, function (e) { estado.erro = e.message; estado.status = "erro"; notificar(); });
    });
  }

  function conectar() {
    if (!configurado()) {
      estado.status = "erro"; estado.erro = "Preencha a configuração do Firebase."; notificar();
      return Promise.reject(new Error(estado.erro));
    }
    estado.status = "conectando"; estado.erro = ""; notificar();
    return carregarSDK().then(function () {
      if (!w.firebase.apps.length) w.firebase.initializeApp(config());
      db = w.firebase.firestore();
      estado.ligado = true;
      estado.status = "conectado";
      definirAuto(true);
      notificar();
      /* 1) mescla local + nuvem  2) passa a ouvir  3) replica gravações */
      return sincronizacaoInicial().then(function () {
        escutar();
        if (!ligadoOnChange) {
          ligadoOnChange = true;
          DB.onChange(function () { if (estado.ligado) enviarTudo(); });
        }
        if (w.Router && Router.refresh) Router.refresh();
        return true;
      });
    }).catch(function (e) {
      estado.status = "erro"; estado.erro = e.message; estado.ligado = false; notificar();
      throw e;
    });
  }

  function desconectar() {
    estado.ligado = false; estado.status = "desligado"; definirAuto(false); notificar();
    location.reload();
  }

  w.Cloud = {
    COLECOES: COLECOES,
    config: config, salvarConfig: salvarConfig, configurado: configurado,
    conectar: conectar, desconectar: desconectar, enviarTudo: enviarTudo,
    estado: function () { return estado; },
    onStatus: function (f) { ouvintes.push(f); f(estado); }
  };

  document.addEventListener("DOMContentLoaded", function () {
    if (configurado() && autoConectar()) conectar().catch(function () { /* segue offline */ });
  });
})(window);

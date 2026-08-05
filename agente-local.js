/* Ponte do ERP com o Agente Local de Certificado Digital (127.0.0.1:8712).
   Detecta certificados A1/A3 instalados na máquina e dispara a validação
   junto à SEFAZ (mTLS) e à cadeia ICP-Brasil. */
(function (w) {
  var BASE = "http://127.0.0.1:8712";
  var TEMPO = { status: 4000, detectar: 60000, validar: 90000 };

  var cache = { online: null, verificadoEm: 0, dados: null };

  function requisicao(rota, opcoes, tempo) {
    opcoes = opcoes || {};
    var ctrl = w.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, tempo || 15000) : null;
    return fetch(BASE + rota, {
      method: opcoes.method || "GET",
      headers: { "Content-Type": "application/json" },
      body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
      signal: ctrl ? ctrl.signal : undefined,
      cache: "no-store"
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j && j.erro ? j.erro : "Erro " + r.status + " no agente local.");
        return j;
      });
    }).catch(function (e) {
      if (timer) clearTimeout(timer);
      if (e && e.name === "AbortError") throw new Error("O agente local nao respondeu a tempo.");
      if (e instanceof TypeError) throw new Error("AGENTE_OFFLINE");
      throw e;
    });
  }

  function status() {
    return requisicao("/api/status", null, TEMPO.status).then(function (r) {
      cache.online = true; cache.verificadoEm = Date.now(); cache.dados = r;
      return r;
    }).catch(function (e) {
      cache.online = false; cache.verificadoEm = Date.now(); cache.dados = null;
      throw e;
    });
  }

  function detectar() { return requisicao("/api/certificados", null, TEMPO.detectar); }
  function drivers() { return requisicao("/api/drivers", null, TEMPO.status); }
  function validar(payload) { return requisicao("/api/validar", { method: "POST", body: payload }, TEMPO.validar); }

  w.Agente = {
    BASE: BASE,
    status: status,
    detectar: detectar,
    drivers: drivers,
    validar: validar,
    offline: function () { return cache.online === false; },
    ultimo: function () { return cache; },
    ehErroOffline: function (e) { return String(e && e.message) === "AGENTE_OFFLINE"; }
  };
})(window);

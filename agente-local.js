/* Ponte do ERP com o Agente Local de Certificado Digital (127.0.0.1:8712) — v2.0
   Detecta certificados A1/A3 instalados, valida junto à SEFAZ/ICP-Brasil e
   ASSINA + TRANSMITE a NF-e aos webservices oficiais.

   Correções desta versão:
   - tenta 127.0.0.1 e localhost (algumas máquinas resolvem só um dos dois);
   - envia o cabeçalho de Private Network Access e explica o bloqueio do Chrome;
   - diferencia "agente parado" de "navegador bloqueou a conexão local". */
(function (w) {
  var BASES = ["http://127.0.0.1:8712", "http://localhost:8712"];
  var BASE = BASES[0];
  var TEMPO = { status: 5000, detectar: 90000, validar: 120000, emitir: 300000 };

  var cache = { online: null, verificadoEm: 0, dados: null, bloqueado: false };

  function paginaSegura() {
    return w.location && w.location.protocol === "https:";
  }

  function chamar(base, rota, opcoes, tempo) {
    opcoes = opcoes || {};
    var ctrl = w.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, tempo || 15000) : null;
    return fetch(base + rota, {
      method: opcoes.method || "GET",
      headers: { "Content-Type": "application/json" },
      body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
      signal: ctrl ? ctrl.signal : undefined,
      mode: "cors",
      cache: "no-store"
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      return r.text().then(function (texto) {
        var j = null;
        try { j = JSON.parse(texto); } catch (e) { j = null; }
        if (!r.ok) throw new Error(j && j.erro ? j.erro : "Erro " + r.status + " no agente local.");
        if (j === null) throw new Error("Resposta inválida do agente local.");
        return j;
      });
    }, function (e) {
      if (timer) clearTimeout(timer);
      if (e && e.name === "AbortError") throw new Error("O agente local não respondeu a tempo.");
      throw new Error("AGENTE_OFFLINE");
    });
  }

  /* Tenta as duas bases; memoriza a que funcionou. */
  function requisicao(rota, opcoes, tempo) {
    return chamar(BASE, rota, opcoes, tempo).catch(function (e) {
      if (String(e.message) !== "AGENTE_OFFLINE") throw e;
      var outra = BASES.filter(function (b) { return b !== BASE; })[0];
      if (!outra) throw e;
      return chamar(outra, rota, opcoes, tempo).then(function (r) { BASE = outra; return r; });
    });
  }

  function status() {
    return requisicao("/api/status", null, TEMPO.status).then(function (r) {
      cache.online = true; cache.bloqueado = false; cache.verificadoEm = Date.now(); cache.dados = r;
      return r;
    }, function (e) {
      cache.online = false; cache.verificadoEm = Date.now(); cache.dados = null;
      cache.bloqueado = paginaSegura();
      throw e;
    });
  }

  function diagnostico(uf, ambiente) {
    return requisicao("/api/diagnostico?uf=" + encodeURIComponent(uf || "RS") + "&ambiente=" + (ambiente || "2"), null, 25000);
  }

  function monitorar(aoMudar, intervalo) {
    var anterior = null;
    function ciclo() {
      status().then(function (r) {
        if (anterior !== true) { anterior = true; try { aoMudar(true, r); } catch (e) { /* callback */ } }
      }, function () {
        if (anterior !== false) { anterior = false; try { aoMudar(false, null); } catch (e) { /* callback */ } }
      });
    }
    ciclo();
    var t = setInterval(ciclo, intervalo || 8000);
    return function () { clearInterval(t); };
  }

  function detectar() { return requisicao("/api/certificados", null, TEMPO.detectar); }
  function drivers() { return requisicao("/api/drivers", null, TEMPO.status); }
  function validar(payload) { return requisicao("/api/validar", { method: "POST", body: payload }, TEMPO.validar); }

  /* ---------------- NF-e ---------------- */
  function emitirNFe(payload) { return requisicao("/api/nfe/emitir", { method: "POST", body: payload }, TEMPO.emitir); }
  function consultarNFe(payload) { return requisicao("/api/nfe/consultar", { method: "POST", body: payload }, TEMPO.validar); }
  function cancelarNFe(payload) { return requisicao("/api/nfe/cancelar", { method: "POST", body: payload }, TEMPO.emitir); }
  function assinarXml(payload) { return requisicao("/api/nfe/assinar", { method: "POST", body: payload }, TEMPO.validar); }

  function mensagemOffline() {
    return paginaSegura()
      ? "Não foi possível falar com o Agente Local. Verifique se ele está em execução " +
        "e, no Chrome/Edge, se o acesso à rede local está permitido para este site " +
        "(ícone de cadeado > Configurações do site > Acesso à rede local)."
      : "Agente local não está em execução. Abra o CCGambin Agente Local e tente de novo.";
  }

  w.Agente = {
    BASE: BASE,
    bases: BASES,
    status: status,
    detectar: detectar,
    drivers: drivers,
    diagnostico: diagnostico,
    monitorar: monitorar,
    validar: validar,
    emitirNFe: emitirNFe,
    consultarNFe: consultarNFe,
    cancelarNFe: cancelarNFe,
    assinarXml: assinarXml,
    offline: function () { return cache.online === false; },
    ultimo: function () { return cache; },
    mensagemOffline: mensagemOffline,
    ehErroOffline: function (e) { return String(e && e.message) === "AGENTE_OFFLINE"; }
  };
})(window);

/* Persistência local (localStorage) — base de dados do ERP */
(function (w) {
  var PREFIX = "ccgambin:";
  var listeners = [];

  function emit() { listeners.forEach(function (l) { l(); }); }

  function read(col) {
    try { return JSON.parse(localStorage.getItem(PREFIX + col) || "[]") || []; }
    catch (e) { return []; }
  }
  function write(col, rows) {
    localStorage.setItem(PREFIX + col, JSON.stringify(rows));
    emit();
  }
  function novoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  w.DB = {
    read: read,
    write: write,
    novoId: novoId,
    onChange: function (cb) { listeners.push(cb); },
    insert: function (col, row) {
      var full = Object.assign({}, row, { id: row.id || novoId() });
      write(col, read(col).concat([full]));
      return full;
    },
    update: function (col, id, patch) {
      write(col, read(col).map(function (r) { return r.id === id ? Object.assign({}, r, patch) : r; }));
    },
    remove: function (col, id) {
      write(col, read(col).filter(function (r) { return r.id !== id; }));
    },
    clearAll: function () {
      Object.keys(localStorage).filter(function (k) { return k.indexOf(PREFIX) === 0; })
        .forEach(function (k) { localStorage.removeItem(k); });
      emit();
    },
    config: function () {
      var c = read("config")[0] || {};
      return Object.assign({ empresa: "C.C GAMBIN", cnpj: "", telefone: "", endereco: "" }, c);
    },
    salvarConfig: function (cfg) { write("config", [Object.assign({ id: "config" }, cfg)]); }
  };
})(window);

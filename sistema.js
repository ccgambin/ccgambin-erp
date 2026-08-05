/* Manutenção do sistema: importação de backup e download do código-fonte (HTML + módulos .js) */
(function (w) {
  var ARQUIVOS = [
    "index.html",
    "404.html",
    "styles.css",
    "storage.js",
    "utils.js",
    "ui.js",
    "firebase.js",
    "domain.js",
    "fiscal.js",
    "usuarios.js",
    "login.js",
    "dashboard.js",
    "produtos.js",
    "estoque.js",
    "movimentacao.js",
    "pessoas.js",
    "negocios.js",
    "financeiro.js",
    "contas.js",
    "relatorios.js",
    "certificados.js",
    "notas.js",
    "sistema.js",
    "configuracoes.js",
    "router.js",
    "app.js"
  ];

  /* ---------- ZIP (método "store", sem compressão) ---------- */
  var TABELA_CRC = (function () {
    var t = [], c, n, k;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function n16(v) { return [v & 0xff, (v >>> 8) & 0xff]; }
  function n32(v) { return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]; }

  function criarZip(entradas) {
    var partes = [], central = [], offset = 0, enc = new TextEncoder();
    entradas.forEach(function (e) {
      var nome = enc.encode(e.nome);
      var dados = enc.encode(e.conteudo);
      var crc = crc32(dados);
      var cabecalho = [].concat(
        n32(0x04034b50), n16(20), n16(0), n16(0), n16(0), n16(0),
        n32(crc), n32(dados.length), n32(dados.length), n16(nome.length), n16(0)
      );
      partes.push(new Uint8Array(cabecalho), nome, dados);
      central.push({ nome: nome, crc: crc, tam: dados.length, offset: offset });
      offset += cabecalho.length + nome.length + dados.length;
    });

    var inicioCentral = offset, tamCentral = 0;
    central.forEach(function (c) {
      var reg = [].concat(
        n32(0x02014b50), n16(20), n16(20), n16(0), n16(0), n16(0), n16(0),
        n32(c.crc), n32(c.tam), n32(c.tam), n16(c.nome.length),
        n16(0), n16(0), n16(0), n16(0), n32(0), n32(c.offset)
      );
      partes.push(new Uint8Array(reg), c.nome);
      tamCentral += reg.length + c.nome.length;
    });
    partes.push(new Uint8Array([].concat(
      n32(0x06054b50), n16(0), n16(0), n16(central.length), n16(central.length),
      n32(tamCentral), n32(inicioCentral), n16(0)
    )));
    return new Blob(partes, { type: "application/zip" });
  }

  function baixar(blob, nome) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  w.Sistema = {
    ARQUIVOS: ARQUIVOS,
    baixar: baixar,

    /* Baixa index.html, o CSS e todos os módulos .js em um único .zip */
    baixarCodigo: function (aoStatus) {
      function avisar(t) { if (typeof aoStatus === "function") aoStatus(t); }
      avisar("Preparando download do código-fonte...");
      var base = location.href.replace(/[^/]*$/, "");
      return Promise.all(ARQUIVOS.map(function (nome) {
        return fetch(base + nome, { cache: "no-store" }).then(function (r) {
          if (!r.ok) throw new Error("Falha ao ler " + nome);
          return r.text();
        }).then(function (txt) { return { nome: "CCGAMBIN-ERP/" + nome, conteudo: txt }; });
      })).then(function (entradas) {
        baixar(criarZip(entradas), "CCGAMBIN-ERP-codigo.zip");
        avisar("Download iniciado: " + entradas.length + " arquivos (HTML, CSS e módulos .js).");
      }).catch(function (e) {
        avisar("Não foi possível baixar o código: " + e.message);
      });
    },

    /* Gera o objeto de backup completo */
    gerarBackup: function () {
      var out = { app: "CCGAMBIN-ERP", versao: "1.3", data: new Date().toISOString(), dados: {} };
      Cloud.COLECOES.forEach(function (c) { out.dados[c] = DB.read(c); });
      out.dados.config = DB.read("config");
      return out;
    },

    /* Lê um backup JSON e grava no sistema. modo: "substituir" | "mesclar" */
    importarBackup: function (texto, modo) {
      var json = JSON.parse(texto);
      var dados = json && json.dados ? json.dados : json;
      if (!dados || typeof dados !== "object") throw new Error("Arquivo de backup inválido.");
      var colecoes = Cloud.COLECOES.concat(["config"]);
      var total = 0;
      colecoes.forEach(function (col) {
        var linhas = dados[col];
        if (!Array.isArray(linhas)) return;
        if (modo === "mesclar") {
          var atuais = DB.read(col);
          var ids = {};
          atuais.forEach(function (r) { ids[r.id] = true; });
          linhas.forEach(function (r) {
            if (!r.id) r.id = DB.novoId();
            if (!ids[r.id]) { atuais.push(r); ids[r.id] = true; }
          });
          DB.write(col, atuais);
          total += linhas.length;
        } else {
          DB.write(col, linhas);
          total += linhas.length;
        }
      });
      return total;
    }
  };
})(window);

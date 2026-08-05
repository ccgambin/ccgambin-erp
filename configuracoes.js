/* Dados da empresa, integração Firebase e manutenção da base */
(function (w) {
  w.Modulos = w.Modulos || {};
  w.Modulos.configuracoes = function (el) {
    var cfg = DB.config();
    var fb = Cloud.config();
    var st = Cloud.estado();
    var classe = st.status === "conectado" ? "on" : (st.status === "erro" ? "off" : "");
    var rotulo = st.status === "conectado" ? "Firebase conectado"
      : st.status === "conectando" ? "Conectando..."
      : st.status === "erro" ? "Erro: " + (st.erro || "") : "Firebase desconectado";

    el.innerHTML = UI.pagina("Configurações", "Dados da empresa, nuvem e manutenção do sistema",
      '<div class="grid g4" style="margin-bottom:18px">' +
        UI.stat("Empresa", UI.esc(cfg.empresa || "-"), "c1") +
        UI.stat("Registros na base", Cloud.COLECOES.reduce(function (t, c) { return t + DB.read(c).length; }, 0), "c5") +
        UI.stat("Nuvem", '<span class="cloud ' + classe + '">' + UI.esc(rotulo) + "</span>", st.status === "conectado" ? "c2" : "c3") +
        UI.stat("Último sincronismo", st.ultimoSync ? new Date(st.ultimoSync).toLocaleTimeString("pt-BR") : "-", "c6") +
      "</div>" +
      '<div class="card"><h2>Dados da empresa</h2><form id="frm"><div class="grid g2 linhas">' +
        UI.campo("Empresa", UI.input("empresa", { value: cfg.empresa })) +
        UI.campo("CNPJ", UI.input("cnpj", { value: cfg.cnpj, mask: "documento" })) +
        UI.campo("Telefone", UI.input("telefone", { value: cfg.telefone, mask: "telefone" })) +
        UI.campo("Endereço", UI.input("endereco", { value: cfg.endereco })) +
      '</div><div class="row" style="margin-top:14px"><button class="btn">Salvar</button></div>' +
      "</form></div>" +

      '<div class="card"><h2>Integração Firebase (nuvem)</h2>' +
      '<p style="font-size:13px;color:var(--muted);margin-bottom:14px">Informe os dados do seu projeto Firebase ' +
      "(Console Firebase &gt; Configurações do projeto &gt; Seus apps &gt; SDK). Com a conexão ativa, todos os módulos " +
      "sincronizam automaticamente com o Firestore.</p>" +
      '<form id="frmFb"><div class="grid g2 linhas">' +
        UI.campo("apiKey", UI.input("apiKey", { value: fb.apiKey })) +
        UI.campo("authDomain", UI.input("authDomain", { value: fb.authDomain, placeholder: "seu-projeto.firebaseapp.com" })) +
        UI.campo("projectId", UI.input("projectId", { value: fb.projectId })) +
        UI.campo("storageBucket", UI.input("storageBucket", { value: fb.storageBucket })) +
        UI.campo("messagingSenderId", UI.input("messagingSenderId", { value: fb.messagingSenderId })) +
        UI.campo("appId", UI.input("appId", { value: fb.appId })) +
      '</div><div class="row" style="margin-top:14px">' +
      '<button class="btn">Salvar e conectar</button>' +
      '<button type="button" class="btn ghost" id="enviar">Enviar base para a nuvem</button>' +
      '<button type="button" class="btn danger" id="desconectar">Desconectar</button>' +
      '</div><p class="aviso" id="msgFb" hidden></p></form></div>' +

      '<div class="card"><h2>Base de dados</h2><p style="font-size:13px;color:var(--muted);margin-bottom:14px">' +
      "Os dados ficam salvos neste navegador (localStorage) e, quando conectado, também no Firebase.</p>" +
      '<div class="row"><button class="btn ghost" id="demo">Gerar dados de exemplo</button>' +
      '<button class="btn ghost" id="backup">Baixar backup (JSON)</button>' +
      '<button class="btn" id="importar">Importar backup (JSON)</button>' +
      '<button class="btn danger" id="zerar">Zerar sistema</button></div>' +
      '<input type="file" id="arqBackup" accept="application/json,.json" hidden />' +
      '<p class="aviso" id="msgBackup" hidden></p></div>' +

      '<div class="card"><h2>Código-fonte do sistema</h2>' +
      '<p style="font-size:13px;color:var(--muted);margin-bottom:14px">' +
      'Baixe o sistema completo (index.html, CSS e todos os módulos .js) em um arquivo .zip.</p>' +
      '<div class="row"><button class="btn" id="baixarCodigo">Baixar HTML + módulos .js (.zip)</button></div>' +
      '<p class="aviso" id="msgCodigo" hidden></p></div>');

    UI.ligarCancelar(el, function () { Router.refresh(); });

    el.querySelector("#frm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      DB.salvarConfig(UI.dados(ev.target));
      alert("Configurações salvas.");
    });

    var msgFb = el.querySelector("#msgFb");
    function aviso(t) { msgFb.textContent = t || ""; msgFb.hidden = !t; }

    el.querySelector("#frmFb").addEventListener("submit", function (ev) {
      ev.preventDefault();
      Cloud.salvarConfig(UI.dados(ev.target));
      aviso("Conectando ao Firebase...");
      Cloud.conectar().then(function () { aviso("Conectado! Base sincronizada com o Firestore."); })
        .catch(function (e) { aviso("Falha na conexão: " + e.message); });
    });
    el.querySelector("#enviar").addEventListener("click", function () {
      if (!Cloud.estado().ligado) return aviso("Conecte-se ao Firebase primeiro.");
      Cloud.enviarTudo();
      aviso("Base enviada para a nuvem.");
    });
    el.querySelector("#desconectar").addEventListener("click", function () {
      if (confirm("Desconectar do Firebase? O sistema continua funcionando localmente.")) Cloud.desconectar();
    });

    el.querySelector("#demo").addEventListener("click", function () {
      if (confirm("Gerar dados de exemplo? Produtos, vendedores e fornecedores atuais serão substituídos.")) Domain.gerarDadosDemo();
    });
    el.querySelector("#backup").addEventListener("click", function () {
      var out = Sistema.gerarBackup();
      Sistema.baixar(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }),
        "ccgambin-backup.json");
    });
    var msgBackup = el.querySelector("#msgBackup");
    function avisoBackup(t) { msgBackup.textContent = t || ""; msgBackup.hidden = !t; }
    var arq = el.querySelector("#arqBackup");
    el.querySelector("#importar").addEventListener("click", function () { arq.click(); });
    arq.addEventListener("change", function () {
      var f = arq.files && arq.files[0];
      arq.value = "";
      if (!f) return;
      var modo = confirm(
        "Importar backup \"" + f.name + "\".\n\n" +
        "OK = SUBSTITUIR os dados atuais pelo backup.\n" +
        "Cancelar = MESCLAR (mantém os dados atuais e adiciona os que faltam)."
      ) ? "substituir" : "mesclar";
      var leitor = new FileReader();
      leitor.onload = function () {
        try {
          var total = Sistema.importarBackup(String(leitor.result), modo);
          avisoBackup("Backup importado (" + modo + "): " + total + " registros.");
          if (Cloud.estado().ligado) Cloud.enviarTudo();
        } catch (e) {
          avisoBackup("Falha ao importar: " + e.message);
        }
      };
      leitor.onerror = function () { avisoBackup("Não foi possível ler o arquivo."); };
      leitor.readAsText(f);
    });

    var msgCodigo = el.querySelector("#msgCodigo");
    el.querySelector("#baixarCodigo").addEventListener("click", function () {
      Sistema.baixarCodigo(function (t) { msgCodigo.textContent = t || ""; msgCodigo.hidden = !t; });
    });

    el.querySelector("#zerar").addEventListener("click", function () {
      if (confirm("Apagar TODOS os dados do sistema?")) DB.clearAll();
    });
  };
})(window);

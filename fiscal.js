/* Biblioteca fiscal: chave de acesso, XML NF-e 4.00, evento de cancelamento,
   ZIP (armazenamento sem compressão) e download de arquivos. */
(function (w) {
  var UFS = {
    AC: "12", AL: "27", AP: "16", AM: "13", BA: "29", CE: "23", DF: "53", ES: "32", GO: "52",
    MA: "21", MT: "51", MS: "50", MG: "31", PA: "15", PB: "25", PR: "41", PE: "26", PI: "22",
    RJ: "33", RN: "24", RS: "43", RO: "11", RR: "14", SC: "42", SP: "35", SE: "28", TO: "17"
  };
  var AMBIENTES = [
    { valor: "2", label: "2 - Homologação (teste)" },
    { valor: "1", label: "1 - Produção" }
  ];
  var MODELOS = [
    { valor: "55", label: "55 - NF-e (Nota Fiscal Eletrônica)" },
    { valor: "65", label: "65 - NFC-e (Consumidor)" }
  ];
  var NATUREZAS = ["VENDA DE MERCADORIA", "DEVOLUCAO DE VENDA", "REMESSA PARA CONSERTO",
    "TRANSFERENCIA DE MERCADORIA", "BONIFICACAO", "SIMPLES REMESSA"];

  function dig(v) { return String(v == null ? "" : v).replace(/\D/g, ""); }
  function pad(v, n) {
    var s = dig(v);
    while (s.length < n) s = "0" + s;
    return s.slice(-n);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c];
    });
  }
  /* Remove acentos e caracteres não aceitos pela SEFAZ */
  function texto(s, max) {
    var t = String(s == null ? "" : s);
    t = t.normalize ? t.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : t;
    t = t.replace(/[^A-Za-z0-9 .,\-\/()]/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
    return max ? t.substring(0, max) : t;
  }
  function num(v, casas) {
    var n = w.Utils ? Utils.numero(v) : Number(v) || 0;
    return n.toFixed(casas == null ? 2 : casas);
  }
  function ufCodigo(uf) { return UFS[String(uf || "").toUpperCase()] || "43"; }

  /* Dígito verificador da chave (módulo 11, pesos 2..9) */
  function dvChave(ch43) {
    var peso = 2, soma = 0;
    for (var i = ch43.length - 1; i >= 0; i--) {
      soma += Number(ch43[i]) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    var r = soma % 11;
    return String(r === 0 || r === 1 ? 0 : 11 - r);
  }
  /* Chave de acesso de 44 dígitos */
  function chaveAcesso(p) {
    var data = String(p.data || "").substring(0, 10).split("-");
    var aamm = String(data[0] || "").slice(2) + (data[1] || "01");
    var base = pad(ufCodigo(p.uf), 2) + pad(aamm, 4) + pad(p.cnpj, 14) + pad(p.modelo || "55", 2) +
      pad(p.serie || "1", 3) + pad(p.numero || "1", 9) + pad(p.tpEmis || "1", 1) + pad(p.cNF, 8);
    return base + dvChave(base);
  }
  function codigoNumerico() {
    return pad(String(Math.floor(Math.random() * 100000000)), 8);
  }
  function chaveFormatada(ch) {
    return dig(ch).replace(/(\d{4})(?=\d)/g, "$1 ").trim();
  }
  function proximoNumero(serie) {
    var s = String(serie || "1");
    var nums = DB.read("notas").filter(function (n) { return String(n.serie) === s; })
      .map(function (n) { return Number(dig(n.numero)) || 0; });
    return (nums.length ? Math.max.apply(null, nums) : 0) + 1;
  }

  /* ---------- XML da NF-e (layout 4.00) ---------- */
  function xmlEndereco(tag, p) {
    return "<" + tag + ">" +
      "<xLgr>" + esc(texto(p.endereco || "SEM ENDERECO", 60)) + "</xLgr>" +
      "<nro>" + esc(texto(p.numero || "SN", 60)) + "</nro>" +
      (p.bairro ? "<xBairro>" + esc(texto(p.bairro, 60)) + "</xBairro>" : "<xBairro>CENTRO</xBairro>") +
      "<cMun>" + pad(p.codigoMunicipio || "4300000", 7) + "</cMun>" +
      "<xMun>" + esc(texto(p.cidade || "NAO INFORMADO", 60)) + "</xMun>" +
      "<UF>" + esc(String(p.uf || "RS").toUpperCase().substring(0, 2)) + "</UF>" +
      (dig(p.cep) ? "<CEP>" + pad(p.cep, 8) + "</CEP>" : "") +
      "<cPais>1058</cPais><xPais>BRASIL</xPais>" +
      (dig(p.telefone) ? "<fone>" + dig(p.telefone).substring(0, 14) + "</fone>" : "") +
      "</" + tag + ">";
  }

  function xmlNFe(nota, opcoes) {
    /* Quando a nota ja foi autorizada pela SEFAZ, o XML oficial (nfeProc
       assinado + protocolo real) é o que vale. */
    if (!(opcoes && opcoes.somenteNFe) && nota.procXml) return nota.procXml;
    var em = nota.emitente || {};
    var de = nota.destinatario || {};
    var itens = nota.itens || [];
    var docDest = dig(de.documento);
    var totalProd = itens.reduce(function (t, i) { return t + Utils.numero(i.quantidade) * Utils.numero(i.valorUnitario); }, 0);
    var frete = Utils.numero(nota.frete), desc = Utils.numero(nota.desconto);
    var total = totalProd + frete - desc;

    var ide = "<ide>" +
      "<cUF>" + pad(ufCodigo(em.uf), 2) + "</cUF>" +
      "<cNF>" + pad(nota.cNF, 8) + "</cNF>" +
      "<natOp>" + esc(texto(nota.naturezaOperacao || "VENDA DE MERCADORIA", 60)) + "</natOp>" +
      "<mod>" + pad(nota.modelo || "55", 2) + "</mod>" +
      "<serie>" + Number(dig(nota.serie) || 1) + "</serie>" +
      "<nNF>" + Number(dig(nota.numero) || 1) + "</nNF>" +
      "<dhEmi>" + dataHoraSefaz(nota.dhEmi) + "</dhEmi>" +
      "<tpNF>" + (nota.tipoOperacao || "1") + "</tpNF>" +
      "<idDest>" + (String(de.uf || em.uf) === String(em.uf) ? "1" : "2") + "</idDest>" +
      "<cMunFG>" + pad(em.codigoMunicipio || "4300000", 7) + "</cMunFG>" +
      "<tpImp>1</tpImp><tpEmis>1</tpEmis>" +
      "<cDV>" + nota.chave.slice(-1) + "</cDV>" +
      "<tpAmb>" + (nota.ambiente || "2") + "</tpAmb>" +
      "<finNFe>" + (nota.finalidade || "1") + "</finNFe>" +
      "<indFinal>" + (nota.consumidorFinal || "1") + "</indFinal>" +
      "<indPres>1</indPres><procEmi>0</procEmi><verProc>CCGAMBIN-ERP-1.6</verProc>" +
      "</ide>";

    var emit = "<emit>" +
      "<CNPJ>" + pad(em.cnpj, 14) + "</CNPJ>" +
      "<xNome>" + esc(texto(em.nome || "EMITENTE", 60)) + "</xNome>" +
      (em.fantasia ? "<xFant>" + esc(texto(em.fantasia, 60)) + "</xFant>" : "") +
      xmlEndereco("enderEmit", em) +
      "<IE>" + (dig(em.ie) || "ISENTO") + "</IE>" +
      "<CRT>" + (em.crt || "1") + "</CRT>" +
      "</emit>";

    var dest = "<dest>" +
      (docDest.length === 14 ? "<CNPJ>" + pad(docDest, 14) + "</CNPJ>" : "<CPF>" + pad(docDest, 11) + "</CPF>") +
      "<xNome>" + esc(texto(de.nome || "CONSUMIDOR", 60)) + "</xNome>" +
      xmlEndereco("enderDest", de) +
      "<indIEDest>" + (dig(de.ie) ? "1" : "9") + "</indIEDest>" +
      (dig(de.ie) ? "<IE>" + dig(de.ie) + "</IE>" : "") +
      (de.email ? "<email>" + esc(de.email) + "</email>" : "") +
      "</dest>";

    var det = itens.map(function (i, idx) {
      var vProd = Utils.numero(i.quantidade) * Utils.numero(i.valorUnitario);
      return '<det nItem="' + (idx + 1) + '">' +
        "<prod>" +
        "<cProd>" + esc(texto(i.codigo || (idx + 1), 60)) + "</cProd>" +
        "<cEAN>SEM GTIN</cEAN>" +
        "<xProd>" + esc(texto(i.descricao || "PRODUTO", 120)) + "</xProd>" +
        "<NCM>" + pad(i.ncm || "00000000", 8) + "</NCM>" +
        "<CFOP>" + pad(i.cfop || "5102", 4) + "</CFOP>" +
        "<uCom>" + esc(texto(i.unidade || "UN", 6)) + "</uCom>" +
        "<qCom>" + num(i.quantidade, 4) + "</qCom>" +
        "<vUnCom>" + num(i.valorUnitario, 10) + "</vUnCom>" +
        "<vProd>" + num(vProd) + "</vProd>" +
        "<cEANTrib>SEM GTIN</cEANTrib>" +
        "<uTrib>" + esc(texto(i.unidade || "UN", 6)) + "</uTrib>" +
        "<qTrib>" + num(i.quantidade, 4) + "</qTrib>" +
        "<vUnTrib>" + num(i.valorUnitario, 10) + "</vUnTrib>" +
        "<indTot>1</indTot>" +
        "</prod>" +
        "<imposto><ICMS><ICMSSN102>" +
        "<orig>0</orig><CSOSN>" + (i.csosn || "102") + "</CSOSN>" +
        "</ICMSSN102></ICMS>" +
        "<PIS><PISNT><CST>07</CST></PISNT></PIS>" +
        "<COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>" +
        "</imposto></det>";
    }).join("");

    var totalXml = "<total><ICMSTot>" +
      "<vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson>" +
      "<vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet>" +
      "<vProd>" + num(totalProd) + "</vProd>" +
      "<vFrete>" + num(frete) + "</vFrete><vSeg>0.00</vSeg>" +
      "<vDesc>" + num(desc) + "</vDesc>" +
      "<vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol>" +
      "<vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro>" +
      "<vNF>" + num(total) + "</vNF>" +
      "</ICMSTot></total>";

    var transp = "<transp><modFrete>" + (nota.modalidadeFrete || "9") + "</modFrete></transp>";
    var pag = "<pag><detPag>" +
      "<indPag>0</indPag><tPag>" + (nota.formaPagamento || "01") + "</tPag>" +
      "<vPag>" + num(total) + "</vPag></detPag></pag>";
    var infAdic = nota.observacao
      ? "<infAdic><infCpl>" + esc(texto(nota.observacao, 500)) + "</infCpl></infAdic>" : "";

    var infNFe = '<infNFe versao="4.00" Id="NFe' + nota.chave + '">' +
      ide + emit + dest + det + totalXml + transp + pag + infAdic + "</infNFe>";

    var assinatura = nota.assinatura
      ? '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo>' +
        '<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>' +
        '<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>' +
        '<Reference URI="#NFe' + nota.chave + '">' +
        "<Transforms>" +
        '<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>' +
        '<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>' +
        "</Transforms>" +
        '<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>' +
        "<DigestValue>" + esc(nota.assinatura.digest) + "</DigestValue>" +
        "</Reference></SignedInfo>" +
        "<SignatureValue>" + esc(nota.assinatura.valor) + "</SignatureValue>" +
        "<KeyInfo><X509Data><X509Certificate>" + esc(nota.assinatura.certificado) +
        "</X509Certificate></X509Data></KeyInfo></Signature>"
      : "";

    /* XML da NF-e sem assinatura e sem protocolo: é o que vai para o agente
       local assinar com o certificado e transmitir à SEFAZ. */
    if (opcoes && opcoes.somenteNFe) {
      return '<?xml version="1.0" encoding="UTF-8"?>' +
        '<NFe xmlns="http://www.portalfiscal.inf.br/nfe">' + infNFe + '</NFe>';
    }

    return '<?xml version="1.0" encoding="UTF-8"?>' +
      '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">' +
      '<NFe xmlns="http://www.portalfiscal.inf.br/nfe">' + infNFe + assinatura + "</NFe>" +
      (nota.protocolo
        ? '<protNFe versao="4.00"><infProt><tpAmb>' + (nota.ambiente || "2") + "</tpAmb>" +
          "<verAplic>CCGAMBIN-ERP</verAplic><chNFe>" + nota.chave + "</chNFe>" +
          "<dhRecbto>" + nota.protocolo.dataHora + "</dhRecbto>" +
          "<nProt>" + esc(nota.protocolo.numero) + "</nProt>" +
          "<digVal>" + esc(nota.protocolo.digest || "") + "</digVal>" +
          "<cStat>" + esc(nota.protocolo.status || "100") + "</cStat>" +
          "<xMotivo>" + esc(nota.protocolo.motivo || "Autorizado o uso da NF-e") + "</xMotivo>" +
          "</infProt></protNFe>"
        : "") +
      "</nfeProc>";
  }

  /* ---------- XML do evento de cancelamento (110111) ---------- */
  function xmlCancelamento(nota, canc) {
    var em = nota.emitente || {};
    var id = "ID110111" + nota.chave + "01";
    var inf = '<infEvento Id="' + id + '">' +
      "<cOrgao>" + pad(ufCodigo(em.uf), 2) + "</cOrgao>" +
      "<tpAmb>" + (nota.ambiente || "2") + "</tpAmb>" +
      "<CNPJ>" + pad(em.cnpj, 14) + "</CNPJ>" +
      "<chNFe>" + nota.chave + "</chNFe>" +
      "<dhEvento>" + canc.dataHora + "</dhEvento>" +
      "<tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento>" +
      "<detEvento versao=\"1.00\"><descEvento>Cancelamento</descEvento>" +
      "<nProt>" + esc(canc.protocoloNFe || "") + "</nProt>" +
      "<xJust>" + esc(texto(canc.justificativa, 255)) + "</xJust>" +
      "</detEvento></infEvento>";
    return '<?xml version="1.0" encoding="UTF-8"?>' +
      '<procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">' +
      '<evento versao="1.00">' + inf + "</evento>" +
      '<retEvento versao="1.00"><infEvento>' +
      "<tpAmb>" + (nota.ambiente || "2") + "</tpAmb><verAplic>CCGAMBIN-ERP</verAplic>" +
      "<cOrgao>" + pad(ufCodigo(em.uf), 2) + "</cOrgao>" +
      "<cStat>135</cStat><xMotivo>Evento registrado e vinculado a NF-e</xMotivo>" +
      "<chNFe>" + nota.chave + "</chNFe><tpEvento>110111</tpEvento>" +
      "<xEvento>Cancelamento registrado</xEvento><nSeqEvento>1</nSeqEvento>" +
      "<dhRegEvento>" + canc.dataHora + "</dhRegEvento>" +
      "<nProt>" + esc(canc.protocolo || "") + "</nProt>" +
      "</infEvento></retEvento></procEventoNFe>";
  }

  /* Evento de cancelamento SEM assinatura — enviado ao agente local para ser
     assinado com o certificado e transmitido ao RecepcaoEvento4 da SEFAZ. */
  function xmlEventoCancelamento(nota, canc) {
    var em = nota.emitente || {};
    var seq = String(canc.sequencia || "1");
    var id = "ID110111" + nota.chave + pad(seq, 2);
    return '<?xml version="1.0" encoding="UTF-8"?>' +
      '<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">' +
      '<infEvento Id="' + id + '">' +
      "<cOrgao>" + pad(ufCodigo(em.uf), 2) + "</cOrgao>" +
      "<tpAmb>" + (nota.ambiente || "2") + "</tpAmb>" +
      "<CNPJ>" + pad(em.cnpj, 14) + "</CNPJ>" +
      "<chNFe>" + nota.chave + "</chNFe>" +
      "<dhEvento>" + (canc.dataHoraSefaz || dataHoraSefaz(canc.dataHora)) + "</dhEvento>" +
      "<tpEvento>110111</tpEvento><nSeqEvento>" + Number(seq) + "</nSeqEvento><verEvento>1.00</verEvento>" +
      '<detEvento versao="1.00"><descEvento>Cancelamento</descEvento>' +
      "<nProt>" + esc(canc.protocoloNFe || "") + "</nProt>" +
      "<xJust>" + esc(texto(canc.justificativa, 255)) + "</xJust>" +
      "</detEvento></infEvento></evento>";
  }

  /* Data/hora no formato exigido pela SEFAZ: AAAA-MM-DDThh:mm:ss-03:00 */
  function dataHoraSefaz(valor) {
    var d = valor ? new Date(valor) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    function p2(v) { return (v < 10 ? "0" : "") + v; }
    var off = -d.getTimezoneOffset();
    var sinal = off >= 0 ? "+" : "-";
    var abs = Math.abs(off);
    return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + "T" +
      p2(d.getHours()) + ":" + p2(d.getMinutes()) + ":" + p2(d.getSeconds()) +
      sinal + p2(Math.floor(abs / 60)) + ":" + p2(abs % 60);
  }

  function nomeArquivo(nota, sufixo) {
    return nota.chave + (sufixo || "-nfe") + ".xml";
  }

  /* ---------- Download de arquivos ---------- */
  function baixar(nome, conteudo, tipo) {
    var blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo || "application/xml;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ---------- ZIP (método store, sem dependências) ---------- */
  var CRC_TABELA = (function () {
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
    for (var i = 0; i < bytes.length; i++) c = CRC_TABELA[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function bytesUTF8(str) {
    if (w.TextEncoder) return new TextEncoder().encode(str);
    var utf = unescape(encodeURIComponent(str)), arr = new Uint8Array(utf.length);
    for (var i = 0; i < utf.length; i++) arr[i] = utf.charCodeAt(i);
    return arr;
  }
  function n16(v) { return [v & 0xff, (v >>> 8) & 0xff]; }
  function n32(v) { return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]; }
  /* arquivos = [{ nome, conteudo (string) }] */
  function zip(arquivos) {
    var partes = [], central = [], deslocamento = 0;
    arquivos.forEach(function (f) {
      var nome = bytesUTF8(f.nome), dados = bytesUTF8(f.conteudo);
      var crc = crc32(dados);
      var local = [].concat([0x50, 0x4b, 0x03, 0x04], n16(20), n16(0x0800), n16(0), n16(0), n16(0),
        n32(crc), n32(dados.length), n32(dados.length), n16(nome.length), n16(0));
      partes.push(new Uint8Array(local), nome, dados);
      var cab = [].concat([0x50, 0x4b, 0x01, 0x02], n16(20), n16(20), n16(0x0800), n16(0), n16(0), n16(0),
        n32(crc), n32(dados.length), n32(dados.length), n16(nome.length), n16(0), n16(0), n16(0), n16(0),
        n32(0), n32(deslocamento));
      central.push({ cab: cab, nome: nome });
      deslocamento += local.length + nome.length + dados.length;
    });
    var inicioCentral = deslocamento, tamanhoCentral = 0;
    central.forEach(function (c) {
      partes.push(new Uint8Array(c.cab), c.nome);
      tamanhoCentral += c.cab.length + c.nome.length;
    });
    partes.push(new Uint8Array([].concat([0x50, 0x4b, 0x05, 0x06], n16(0), n16(0),
      n16(central.length), n16(central.length), n32(tamanhoCentral), n32(inicioCentral), n16(0))));
    return new Blob(partes, { type: "application/zip" });
  }


  w.Fiscal = {
    UFS: UFS, AMBIENTES: AMBIENTES, MODELOS: MODELOS, NATUREZAS: NATUREZAS,
    ufCodigo: ufCodigo, dvChave: dvChave, chaveAcesso: chaveAcesso, chaveFormatada: chaveFormatada,
    codigoNumerico: codigoNumerico, proximoNumero: proximoNumero,
    xmlNFe: xmlNFe, xmlCancelamento: xmlCancelamento, xmlEventoCancelamento: xmlEventoCancelamento,
    dataHoraSefaz: dataHoraSefaz, nomeArquivo: nomeArquivo,
    baixar: baixar, zip: zip, texto: texto, digitos: dig, pad: pad
  };
})(window);

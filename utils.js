/* Formatação, máscaras, datas e exportação CSV/Excel */
(function (w) {
  function soDigitos(v) { return String(v == null ? "" : v).replace(/\D/g, ""); }

  function moeda(v) {
    return (numero(v)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  /* Aceita número ou texto em formato brasileiro: "1.234,56" -> 1234.56 */
  function numero(v) {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    var s = String(v == null ? "" : v).trim();
    if (!s) return 0;
    s = s.replace(/[R$\s]/g, "");
    if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
    var n = Number(s);
    return isFinite(n) ? n : 0;
  }
  /* Máscara de moeda enquanto digita: sempre 2 casas decimais */
  function mascaraMoeda(v) {
    var d = soDigitos(v).replace(/^0+(?=\d{3})/, "");
    if (!d) return "";
    while (d.length < 3) d = "0" + d;
    var inteiro = d.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return inteiro + "," + d.slice(-2);
  }
  function moedaTexto(v) {
    var n = numero(v);
    return n ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
  }
  function mascaraCPF(v) {
    var d = soDigitos(v).slice(0, 11);
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  function mascaraCNPJ(v) {
    var d = soDigitos(v).slice(0, 14);
    return d.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }
  function mascaraDocumento(v) {
    var d = soDigitos(v);
    return d.length > 11 ? mascaraCNPJ(d) : mascaraCPF(d);
  }
  function mascaraTelefone(v) {
    var d = soDigitos(v).slice(0, 11);
    if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
  }
  function validarCPF(v) {
    var c = soDigitos(v);
    if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    var s, r, i;
    s = 0; for (i = 0; i < 9; i++) s += Number(c[i]) * (10 - i);
    r = (s * 10) % 11 % 10; if (r !== Number(c[9])) return false;
    s = 0; for (i = 0; i < 10; i++) s += Number(c[i]) * (11 - i);
    r = (s * 10) % 11 % 10; return r === Number(c[10]);
  }
  function validarCNPJ(v) {
    var c = soDigitos(v);
    if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
    function dig(base) {
      var p = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      var s = 0;
      for (var i = 0; i < base.length; i++) s += Number(base[i]) * p[i];
      var r = s % 11;
      return r < 2 ? 0 : 11 - r;
    }
    return dig(c.slice(0, 12)) === Number(c[12]) && dig(c.slice(0, 13)) === Number(c[13]);
  }
  function validarDocumento(v) {
    var d = soDigitos(v);
    if (!d) return true;
    return d.length > 11 ? validarCNPJ(d) : validarCPF(d);
  }

  /* Consulta pública de CNPJ (BrasilAPI) */
  function consultarCNPJ(cnpj) {
    var d = soDigitos(cnpj);
    if (d.length !== 14) return Promise.reject(new Error("CNPJ inválido"));
    return fetch("https://brasilapi.com.br/api/cnpj/v1/" + d)
      .then(function (r) { if (!r.ok) throw new Error("CNPJ não encontrado"); return r.json(); })
      .then(function (j) {
        return {
          nome: j.nome_fantasia || j.razao_social || "",
          razaoSocial: j.razao_social || "",
          telefone: mascaraTelefone(j.ddd_telefone_1 || ""),
          email: j.email || "",
          cidade: j.municipio || "",
          uf: j.uf || "",
          endereco: [j.descricao_tipo_de_logradouro, j.logradouro, j.numero, j.bairro]
            .filter(Boolean).join(" ").trim()
        };
      });
  }


  /* ---- CEP: máscara e busca automática de endereço (ViaCEP) ---- */
  function mascaraCEP(v) {
    var d = soDigitos(v).slice(0, 8);
    return d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d;
  }
  function viaCEP(d) {
    return fetch("https://viacep.com.br/ws/" + d + "/json/")
      .then(function (r) { if (!r.ok) throw new Error("falha"); return r.json(); })
      .then(function (j) {
        if (!j || j.erro || !j.localidade) throw new Error("nao encontrado");
        return {
          endereco: j.logradouro || "", bairro: j.bairro || "",
          cidade: j.localidade || "", uf: j.uf || "", complemento: j.complemento || ""
        };
      });
  }
  function brasilAPICEP(d) {
    return fetch("https://brasilapi.com.br/api/cep/v2/" + d)
      .then(function (r) { if (!r.ok) throw new Error("falha"); return r.json(); })
      .then(function (j) {
        if (!j || !j.city) throw new Error("nao encontrado");
        return {
          endereco: j.street || "", bairro: j.neighborhood || "",
          cidade: j.city || "", uf: j.state || "", complemento: ""
        };
      });
  }
  function openCEP(d) {
    return fetch("https://opencep.com/v1/" + d)
      .then(function (r) { if (!r.ok) throw new Error("falha"); return r.json(); })
      .then(function (j) {
        if (!j || !j.localidade) throw new Error("nao encontrado");
        return {
          endereco: j.logradouro || "", bairro: j.bairro || "",
          cidade: j.localidade || "", uf: j.uf || "", complemento: ""
        };
      });
  }
  /* Consulta com 3 provedores em cascata: se um falhar, tenta o próximo. */
  function consultarCEP(cep) {
    var d = soDigitos(cep);
    if (d.length !== 8) return Promise.reject(new Error("CEP inválido"));
    return viaCEP(d)
      .catch(function () { return brasilAPICEP(d); })
      .catch(function () { return openCEP(d); })
      .then(function (a) { a.cep = mascaraCEP(d); return a; })
      .catch(function () { throw new Error("CEP não encontrado"); });
  }



  /* ---- Filtros: comparação de texto sem acento e intervalo de datas ---- */
  function normalizar(v) {
    var s = String(v == null ? "" : v).toLowerCase();
    return s.normalize ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : s;
  }
  function contem(valor, termo) {
    if (!termo) return true;
    return normalizar(valor).indexOf(normalizar(termo)) >= 0;
  }
  function entreDatas(data, de, ate) {
    var d = String(data || "").substring(0, 10);
    if (de && (!d || d < de)) return false;
    if (ate && (!d || d > ate)) return false;
    return true;
  }
  /* Primeiro e último dia do mês corrente (padrão dos filtros por período) */
  function inicioMes() { return hoje().substring(0, 8) + "01"; }

  function hoje() { return new Date().toISOString().substring(0, 10); }
  function dataBR(iso) {
    if (!iso) return "-";
    var p = String(iso).substring(0, 10).split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso;
  }
  function addDias(iso, dias) {
    var d = new Date((iso || hoje()) + "T00:00:00");
    d.setDate(d.getDate() + (Number(dias) || 0));
    return d.toISOString().substring(0, 10);
  }
  function exportarCSV(nome, colunas, linhas) {
    var sep = ";";
    var head = colunas.map(function (c) { return c.label; }).join(sep);
    var body = linhas.map(function (l) {
      return colunas.map(function (c) {
        var v = typeof c.valor === "function" ? c.valor(l) : l[c.chave];
        return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
      }).join(sep);
    }).join("\n");
    var blob = new Blob(["\ufeff" + head + "\n" + body], { type: "text/csv;charset=utf-8;" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  w.Utils = {
    moeda: moeda, numero: numero, hoje: hoje, dataBR: dataBR, addDias: addDias, exportarCSV: exportarCSV,
    soDigitos: soDigitos, mascaraMoeda: mascaraMoeda, moedaTexto: moedaTexto, mascaraCPF: mascaraCPF,
    mascaraCNPJ: mascaraCNPJ, mascaraDocumento: mascaraDocumento, mascaraTelefone: mascaraTelefone,
    validarCPF: validarCPF, validarCNPJ: validarCNPJ, validarDocumento: validarDocumento,
    consultarCNPJ: consultarCNPJ, mascaraCEP: mascaraCEP, consultarCEP: consultarCEP,
    normalizar: normalizar, contem: contem, entreDatas: entreDatas, inicioMes: inicioMes
  };
})(window);

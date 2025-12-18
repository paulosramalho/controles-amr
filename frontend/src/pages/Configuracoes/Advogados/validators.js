// frontend/src/pages/Configuracoes/Advogados/validators.js
// Diretrizes do projeto: CPF com máscara + validação; Telefone com máscara; Datas DD/MM/AAAA; etc.
// Este arquivo foca apenas em validações "reais" (sem depender do backend).

export function onlyDigits(s = "") {
  return String(s).replace(/\D+/g, "");
}

export function isValidCPF(cpf) {
  const n = onlyDigits(cpf);
  if (n.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(n)) return false;

  const calc = (base, factor) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factor - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  const d1 = calc(n.slice(0, 9), 10);
  const d2 = calc(n.slice(0, 10), 11);
  return d1 === Number(n[9]) && d2 === Number(n[10]);
}

export function formatCPF(value) {
  const n = onlyDigits(value).slice(0, 11);
  const p1 = n.slice(0, 3);
  const p2 = n.slice(3, 6);
  const p3 = n.slice(6, 9);
  const p4 = n.slice(9, 11);
  let out = p1;
  if (p2) out += "." + p2;
  if (p3) out += "." + p3;
  if (p4) out += "-" + p4;
  return out;
}

export function isValidOAB(oab) {
  const s = String(oab || "").trim().toUpperCase();
  // Validação pragmática: precisa ter números e pode conter UF ao final (ex.: 12345/PA)
  if (s.length < 4) return false;
  if (!/\d/.test(s)) return false;
  if (!/^[A-Z0-9]+(\/[A-Z]{2})?$/.test(s)) return false;
  return true;
}

export function formatPhoneBR(value) {
  // (99) 9 9999-9999
  const n = onlyDigits(value).slice(0, 11);
  const ddd = n.slice(0, 2);
  const p1 = n.slice(2, 3);
  const p2 = n.slice(3, 7);
  const p3 = n.slice(7, 11);
  let out = "";
  if (ddd) out += `(${ddd})`;
  if (p1) out += ` ${p1}`;
  if (p2) out += ` ${p2}`;
  if (p3) out += `-${p3}`;
  return out.trim();
}

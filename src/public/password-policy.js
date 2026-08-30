// Skupna politika gesla (uporabljena na strani za nastavitev/aktivacijo
// gesla, samopostrežno registracijo in spremembo gesla v profilu) - mora
// ustrezati politiki na strežniku (src/utils/password.js).
const PASSWORD_REQUIREMENTS = [
  { key: "length", label: "Vsaj 10 znakov", test: (p) => p.length >= 10 },
  { key: "upper", label: "Vsaj ena velika črka", test: (p) => /[A-Z]/.test(p) },
  { key: "lower", label: "Vsaj ena mala črka", test: (p) => /[a-z]/.test(p) },
  { key: "digit", label: "Vsaj ena številka", test: (p) => /[0-9]/.test(p) },
  { key: "special", label: "Vsaj en poseben znak", test: (p) => /[^A-Za-z0-9]/.test(p) }
];

function isPasswordValid(password) {
  const pwd = password || "";
  return PASSWORD_REQUIREMENTS.every((r) => r.test(pwd));
}

// poveže input polje za geslo z živo seznamom zahtev (✓/✗) pod njim,
// ki se posodablja ob vsakem vnosu
function wirePasswordChecklist(inputId, checklistId) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(checklistId);
  if (!input || !list) return;

  function render() {
    const pwd = input.value || "";
    list.innerHTML = PASSWORD_REQUIREMENTS.map((r) => {
      const ok = r.test(pwd);
      return `<li class="${ok ? "req-ok" : "req-fail"}">${ok ? "✓" : "✗"} ${r.label}</li>`;
    }).join("");
  }

  input.addEventListener("input", render);
  render();
}

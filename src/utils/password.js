// Skupna politika gesla - uporabljena povsod, kjer uporabnik NASTAVLJA novo
// geslo (aktivacija vabila, samopostrežna registracija, sprememba gesla).
// Pri prijavi se preverja samo bcrypt hash (bcrypt.compare), politika se
// tam NE preverja - to bi zavrnilo obstoječe, že veljavne stare uporabnike.
const PASSWORD_REQUIREMENTS = [
  { key: "length", test: (p) => p.length >= 10 },
  { key: "upper", test: (p) => /[A-Z]/.test(p) },
  { key: "lower", test: (p) => /[a-z]/.test(p) },
  { key: "digit", test: (p) => /[0-9]/.test(p) },
  { key: "special", test: (p) => /[^A-Za-z0-9]/.test(p) }
];

function isPasswordValid(password) {
  const pwd = password || "";
  return PASSWORD_REQUIREMENTS.every((r) => r.test(pwd));
}

const PASSWORD_POLICY_MESSAGE =
  "Geslo mora imeti vsaj 10 znakov ter vsebovati vsaj eno veliko črko, malo črko, številko in poseben znak";

module.exports = { isPasswordValid, PASSWORD_POLICY_MESSAGE };

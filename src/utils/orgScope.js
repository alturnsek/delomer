const db = require("../config/db");

const ORG_MARKER = "{org}";

// Sestavi organization_id-omejen SQL stavek in seznam parametrov, ne da bi ga izvedel.
// Izvožen ločeno od query(), da ga je mogoče testirati brez prave povezave na bazo.
//
// SQL MORA vsebovati marker "{org}" na mestu, kjer naj stoji "organization_id = ?" -
// po dogovoru vedno takoj za WHERE, npr. "SELECT * FROM teams WHERE {org} AND id = ?".
// Tako je pozicija dodanega parametra predvidljiva: organizationId postane prvi "?"
// v stavku. Manjkajoč marker ali manjkajoč organizationId vrže napako, namesto da bi
// tiho izvedel neomejeno poizvedbo čez vsa društva.
function buildScopedQuery(organizationId, sql, params = []) {
  if (!organizationId) {
    throw new Error("orgScope: organizationId je obvezen (manjka req.user.organization_id)");
  }
  if (!sql.includes(ORG_MARKER)) {
    throw new Error(`orgScope: SQL mora vsebovati marker "${ORG_MARKER}" (npr. "WHERE {org} AND id = ?")`);
  }

  return {
    sql: sql.replace(ORG_MARKER, "organization_id = ?"),
    params: [organizationId, ...params]
  };
}

// Izvede poizvedbo, omejeno na eno društvo. Namenjeno NOVIM endpointom:
//
//   const rows = await orgScope.query(req.user.organization_id,
//     "SELECT * FROM teams WHERE {org} AND id = ?", [teamId]);
//
// Obstoječe poizvedbe v admin.js/work.js tega helperja (še) ne uporabljajo - tam
// organization_id ostaja ročno dodan v vsak WHERE (glej KAN-101 razpravo o izolaciji
// med društvi). Cilj tega helperja ni prepisati delujočo kodo, ampak narediti filter
// po društvu v novi kodi obvezen: manjkajoč marker vrže napako namesto da bi tiho
// pustil skozi poizvedbo brez omejitve.
function query(organizationId, sql, params = []) {
  const scoped = buildScopedQuery(organizationId, sql, params);
  return db.query(scoped.sql, scoped.params);
}

module.exports = { query, buildScopedQuery };

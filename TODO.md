# TODO

Delovni seznam za nadaljnji razvoj na `dev` veji. `main` ostaja zamrznjen za predstavitev/zagovor — spremembe sem najprej speljemo skozi `dev`.

Prvotni projektni načrt živi v Jira backlogu, izvožen v [ostalo/Jira.html](ostalo/Jira.html) (131 issue-jev, KAN-5 do KAN-135, vsi še v statusu Backlog). Ta datoteka povzema tisti načrt v obliki checklist-a in dodaja sprotne TODO-je iz razvoja/deploya, ki jih je smiselno reševati tekoče.

## Varnost / pred pravim produkcijskim zagonom

- [ ] Odstrani (ali pogojno onemogoči) debug middleware v [src/app.js](src/app.js#L20-L26), ki v loge izpisuje surov `Cookie` header (vsebuje session ID-je uporabnikov). Trenutno pustimo, ker ni pravih uporabnikov — obvezno odstraniti pred javnim zagonom za prava društva.
- [ ] Google OAuth (`passport-google-oauth20`, že v kodi) — dokončaj konfiguracijo in registriraj produkcijski redirect URI (`https://app.delomer.top/api/users/auth/google/callback`) v Google Cloud Console. Namenoma odloženo, dokler aplikacija ni bolj izpopolnjena.

## Arhitekturne odločitve, ki odstopajo od prvotnega Jira načrta

- **Multi-tenancy**: Jira epic KAN-6 (Tenancy & Whitelabel) je predvidel ločeno subdomeno na društvo (`abc.delomer.top`). Namesto tega smo se odločili za **eno domeno + tri nivoje vlog** (glej spodaj) — enostavnejše za trenutno fazo, brez wildcard DNS/TLS kompleksnosti. Subdomene ostajajo možna nadgradnja, če bo produkt zrasel.
- **Vloge in registracija (POMEMBNO — druga iteracija)**: Prvi poskus (registracija z izbiro "ustvari/pridruži se društvu") je bil **opuščen** v korist invite-only modela s štirimi vlogami:
  - **SUPER_ADMIN** — ustvarja nova društva (ime + prvi admin), upravlja admine vseh društev, edini brez `organization_id`
  - **ADMIN** (društva) — vabi člane po emailu (posamič ali bulk: `Ime,Priimek,Email` na vrstico), popravlja njihove podatke, jim spreminja vlogo (do vključno ADMIN), vidi/ureja dela vseh članov društva, potrjuje/zavrača dela, upravlja kategorije dela
  - **SUPERINTENDENT** — enake operativne pravice kot ADMIN (delo, kategorije, potrjevanje, statistika društva), **ne more** upravljati uporabnikov (vabiti/urejati/spreminjati vlog). Dodano na zahtevo, da lahko ADMIN nekoga "dvigne na svoj nivo" brez da mu da nadzor nad člani.
  - **MEMBER** — se aktivira preko povezave iz vabila (`set-password.html?token=...`), vnaša svoja dela in ureja tista, ki jih je sam ustvaril
  - Ni več javne registracije. Nov uporabnik nastane samo, ko ga povabi ADMIN/SUPER_ADMIN (vrstica v `users` z `password_hash=''` in `invite_token`); ob aktivaciji nastavi geslo.
  - Email pošiljanje je za zdaj samo stub — povezava za nastavitev gesla se izpiše v strežniške loge (`src/utils/invites.js`), pravo pošiljanje (SMTP/Resend/ipd.) je TODO.
  - Prvi SUPER_ADMIN nastane ročno z SQL (`UPDATE users SET role='SUPER_ADMIN' WHERE email=...`, glej [migrations/002_super_admin_and_invites.sql](migrations/002_super_admin_and_invites.sql)), ne preko kode.
  - **Pravice so trenutno samo dvo-nivojske sklope** (`requireRole("ADMIN","SUPERINTENDENT")` vs `requireRole("ADMIN")`), ne granularen permission sistem. Eksplicitno dogovorjeno, da se bo to še razširilo, ko bo jasno kdo natančno sme kaj — glej spodaj.
- **UI**: aplikacija je iz ene monolitne strani prestrukturirana v sidebar/burger meni (`#sidebar`, `.nav-link[data-view]` + `.view` sekcije v [src/public/index.html](src/public/index.html), routing v `showView()` v [src/public/script.js](src/public/script.js)). Nav linki se filtrirajo po `data-roles` glede na vlogo prijavljenega uporabnika. Burger gumb (☰, skrajno levo v headerju) je toggle, stanje odprto/zaprto si zapomni v `localStorage` (per-brskalnik, ne na strežniku). Sidebar je `position: fixed` overlay na skrajnem levem robu zaslona (ne flex-sibling od contenta), zato se content ne oži, ko je meni odprt.
- **Urejanje člana**: namesto `prompt()` poziva se ob kliku na ✏️ inline razširi panel znotraj vrstice člana (ime/priimek/email + Shrani/Prekliči), glej `.member-edit-panel` v `renderOrgMember()`.
- **Zavrnitev dela**: enako inline (namesto `prompt()`) - `.reject-panel` v `renderAdminWorkItem()`. `rejection_reason` se ob ponovni oddaji (REJECTED → PENDING po urejanju) NAMENOMA ne briše več (glej [src/routes/work.js](src/routes/work.js)) - dokler je status PENDING in `rejection_reason` ni prazen, se poleg PENDING prikaže značka "popravljeno po zavrnitvi" (`.status-CORRECTED`).
- **Kategorije dela**: preimenovanje je zdaj tudi inline (`.edit-panel` v `loadCategoriesAdmin()`), ne več `prompt()`.
- **Enoten barvni sistem** v celi aplikaciji: urejanje = modro (`.btn-edit`, `.edit-panel`), potrditev = zeleno (`.btn-approve`), zavrnitev = rdeče (`.btn-reject`, `.reject-panel`). Statusi PENDING/APPROVED/REJECTED se v UI prikažejo v slovenščini ("V obravnavi"/"Potrjeno"/"Zavrnjeno", glej `STATUS_LABELS`/`statusLabel()` v script.js) - interno (DB, CSS razredi `status-PENDING` ipd.) ostane angleški enum. Potrdi/zavrni gumba uporabljata monohromatske znake (✓/✗, ne emoji ✔️/✖️), da pravilno podedujeta belo barvo besedila na obarvani podlagi.
- **Filtri v "Potrjevanje dela"**: datumski razpon (od-do) + bližnjice Danes/Ta teden/Ta mesec/To leto, in filter po statusu (Vsi/V obravnavi/V obravnavi-popravljeno/Potrjeno/Zavrnjeno). Vse client-side nad že pridobljenim seznamom (`adminWorkCache`/`renderAdminWorkList()` v script.js) - brez sprememb na backendu, ker gre za majhno količino podatkov (eno društvo).
- **Deploy target**: Jira (KAN-103, KAN-104) je predvidel Azure + wildcard subdomeno. Trenutno imamo dva neodvisna deploy cilja: Azure VM prek GitHub Actions CI/CD (samo `main`, glej [.github/workflows/deploy.yml](.github/workflows/deploy.yml)) in doma TrueNAS SCALE (Nginx Proxy Manager + Cloudflare, domena `app.delomer.top`) za razvoj/testiranje na `dev` veji.
- **Auth**: koda trenutno uporablja `express-session` (cookie seja, `passport.session()`), medtem ko je KAN-35/40/41 predvideval JWT (userId/tenantId/role) + httpOnly refresh cookie. `jsonwebtoken` je sicer v odvisnostih, a se še ne uporablja za auth flow — preveriti, ali ostanemo pri sejah ali migriramo na JWT.

## Backlog (iz Jira, povzeto po epicih)

### Epic: Foundations (KAN-5)
- [ ] Repo scaffold + monorepo struktura (`/apps/api`, `/apps/web`, `/docs`, `/infra`) — *trenutno je repo enoten Express projekt, ne monorepo; preveriti, ali je monorepo še relevanten*
- [ ] Environment configuration (dev/staging/prod) — seznam env spremenljivk dokumentiran v `/docs`
- [ ] Healthcheck endpoint — **narejeno**, `GET /health` že obstaja v [src/app.js](src/app.js#L130-L132)

### Epic: Tenancy & Whitelabel (KAN-6)
*(glej arhitekturno odločitev zgoraj — subdomene opuščene, model je zdaj SUPER_ADMIN/ADMIN/MEMBER z vabili)*
- [x] Podatkovni model: `organizations` tabela + `users.organization_id`/`users.role` (SUPER_ADMIN/ADMIN/MEMBER) + `invite_token`
- [x] SUPER_ADMIN ustvarja društva + prvega admina (`POST /api/superadmin/organizations`)
- [ ] Tenant isolation na work-log/reporting endpointih (work.js še ne filtrira po `organization_id`, samo po `user_id` — ni nujno narobe dokler ni skupinskih/admin pogledov čez več uporabnikov, a preveriti pri Fazi 2)
- [ ] Public tenant branding endpoint (logo/barve društva)
- [ ] Tenant settings admin UI (admin ureja logo/barve, member read-only)

### Epic: Auth & User (KAN-7)
- [x] Password login, brez razkrivanja obstoja uporabnika (+ popravljen bug: login/register nista več vračala `password_hash` na frontend)
- [x] RBAC guards (`src/middleware/roles.js`: `requireAuth`, `requireRole`) — `requireRole("ADMIN","SUPERINTENDENT")` na delo/kategorije/potrjevanje, `requireRole("ADMIN")` samo na upravljanje uporabnikov, `requireRole("SUPER_ADMIN")` na `/api/superadmin/*`
- [x] Admin vabi uporabnike (posamič + bulk), vidi seznam članov z aktivacijskim statusom — `POST/GET /api/admin/users`, `POST /api/admin/users/bulk`
- [x] Admin ureja podatke člana (ime/priimek/email) — `PUT /api/admin/users/:id`
- [x] Admin (ne pa SUPERINTENDENT) spreminja vlogo člana do vključno ADMIN — `POST /api/admin/users/:id/role`; SUPER_ADMIN enako za katerokoli društvo — `POST /api/superadmin/organizations/:id/users/:userId/role`
- [ ] Admin lahko uporabnika tudi deaktivira (samo sprememba vloge/podatkov, ni "onemogoči prijavo")
- [ ] Granularnejši permission sistem (trenutno samo groba delitev ADMIN/SUPERINTENDENT/MEMBER po routerjih, ne per-akcija)

### Epic: Work Logs (KAN-8)
*(brez ločenega DRAFT koraka — vnos gre direktno v PENDING, poenostavljeno glede na dejanske zahteve)*
- [x] Admin upravlja kategorije dela: dodaj, preimenuj, **deaktiviraj namesto brisanja** (`work_categories.is_active`) — stari vnosi ohranijo kategorijo, nove pa je ni več na voljo v dropdownu (`GET/POST/PUT /api/admin/categories`, `POST /api/admin/categories/:id/(de)activate`, branje samo aktivnih za USER na `GET /api/work/categories`)
- [x] Ustvari vnos (task, čas, kategorija) → status PENDING
- [x] Skupinski vnos: USER doda sodelavce (`work_log_participants`), validirano da so iz istega društva
- [x] **Ekipe** — admin ustvari poimenovano skupino oseb (`teams`/`team_members`, `GET/POST/PUT/DELETE /api/admin/teams`), pri vnosu dela jo lahko izbereš in doda vse člane naenkrat, posamezne pa nato odkljukaš/dodaš
- [x] **Iskanje in sortiranje sodelavcev** pri vnosu dela — filter po predpon i imena/priimka v realnem času, sort A-Ž/Ž-A po imenu ali priimku (client-side, `renderParticipantList()` v script.js)
- [x] **Override ur na posameznega udeleženca** — `work_log_participants.minutes_override`; če ni nastavljen, se uporabi privzeto trajanje vnosa. Nastavlja ustvarjatelj vnosa (kreacija/urejanje) ali admin (`PUT /api/admin/work/:id` zdaj sprejme tudi `participants`)
- [x] Uredi vnos — samo ustvarjatelj, samo dokler ni APPROVED; urejanje REJECTED vnosa ga vrne v PENDING
- [x] Seznam "Moje aktivnosti" — vnosi kjer je uporabnik ustvarjatelj ali sodelavec, s statusom/kategorijo/sodelavci (in njihovimi urami)
- [ ] Admin queue (Potrjevanje dela) še nima gumba za urejanje udeležencev/ur neposredno iz seznama — trenutno se to ureja preko "Vnos dela" forme
- [ ] Gostje (ime+priimek brez računa, ne štejejo v statistiko) — ni implementirano
- [ ] Filtri po statusu/obdobju na seznamu

### Epic: Approvals (KAN-9)
- [x] Admin approval queue — `GET /api/admin/work` (vsi vnosi društva, PENDING najprej)
- [x] Potrdi zapis (PENDING → APPROVED) — `POST /api/admin/work/:id/approve`
- [x] Zavrni zapis z obveznim razlogom (PENDING → REJECTED) — `POST /api/admin/work/:id/reject`
- [x] Auto-approve job (PENDING starejši od 30 dni → APPROVED, `is_auto_approved=1`) — `src/jobs/autoApprove.js`, teče ob zagonu strežnika + vsako uro
- [x] Admin lahko ureja katerikoli vnos v društvu — `PUT /api/admin/work/:id` (task/čas/kategorija; urejanje sodelavcev za admina še ni na voljo)
- [ ] Audit log potrditev/zavrnitev (trenutno samo `reviewed_by`/`reviewed_at` na vnosu, brez ločene zgodovine)

### Epic: Reporting & Export (KAN-10)
- [ ] Poročilo po članih (samo APPROVED, upošteva override, filter po datumu, sort desc)
- [ ] Poročilo po tipu dela (isto, sort desc)
- [ ] CSV izvoz (UTF-8, "by member" + "raw entries", samo admin, brez gostov)

### Epic: DevOps & Deployment (KAN-11)
- [x] Docker build + docker-compose (app + mariadb) — narejeno
- [x] Deploy na TrueNAS (namesto/poleg Azure) prek Nginx Proxy Manager + Cloudflare — narejeno
- [ ] Lint/format/test pipeline
- [ ] Env secrets dokumentirani/urejeni na produkciji (delno narejeno prek `.env.example`)
- ~~Wildcard subdomain routing~~ — opuščeno, glej arhitekturno odločitev zgoraj

### Epic: Documentation (KAN-12)
- [ ] SRS (funkcionalne/nefunkcionalne zahteve, out-of-scope: kartica/RFID/NFC/prstni odtis za MVP)
- [ ] Arhitekturni dokument (komponente, tenancy model, auth, deployment)
- [ ] Podatkovni model (MariaDB) — tabele, relacije, statusi in prehodi, indexing
- [ ] Uporabniški priročnik (member/admin flow)
- [ ] Deployment dokumentacija (Azure + Docker/TrueNAS, env var seznam)

## Statistika in profil

- [x] **Moj profil** (vsi uporabniki) — ime/priimek/email/društvo (samo prikaz, brez urejanja), profilna slika (upload preko `POST /api/users/me/avatar`, multer, shranjeno v `uploads/avatars/` - **trajen Docker volumen `uploads_data:/app/uploads`**, ne v `src/public` ker bi se ob vsakem `--build` izgubilo), graf opravljenih ur skozi čas (`GET /api/users/me/stats?from&to`, Chart.js, privzeto zadnji mesec) — glej [migrations/006_avatar_and_profile_stats.sql](migrations/006_avatar_and_profile_stats.sql)
- [ ] "Statistika društva" (ADMIN/SUPERINTENDENT) in "Statistika društev" (SUPER_ADMIN) so še vedno prazne placeholder sekcije — analogen pristop kot pri profilu (agregacija APPROVED work_logs), samo na nivoju društva/vseh društev namesto enega uporabnika
- **Prihodnja arhitekturna sprememba (dogovorjeno, ne zdaj)**: uporabnik trenutno pripada natanko enemu društvu (`users.organization_id`, striktna 1:1). V prihodnosti načrtovana nadgradnja na možnost, da je en uporabnik član več društev hkrati - to bo zahtevalo many-to-many model (ločena tabela članstev z vlogo per-društvo) in posege v RBAC/delo/potrjevanje. Namenoma odloženo dokler ne bo dejansko potrebno.

## Kasneje / nice-to-have

- [ ] Landing stran na glavni domeni `delomer.top` (app teče na `app.delomer.top`)
- [ ] Subdomena na društvo, če bo produkt zrasel (glej opuščeno KAN-6 zgoraj)

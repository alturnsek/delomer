# TODO

Delovni seznam za nadaljnji razvoj na `dev` veji. `main` ostaja zamrznjen za predstavitev/zagovor — spremembe sem najprej speljemo skozi `dev`.

Prvotni projektni načrt živi v Jira backlogu, izvožen v [ostalo/Jira.html](ostalo/Jira.html) (131 issue-jev, KAN-5 do KAN-135, vsi še v statusu Backlog). Ta datoteka povzema tisti načrt v obliki checklist-a in dodaja sprotne TODO-je iz razvoja/deploya, ki jih je smiselno reševati tekoče.

## Varnost / pred pravim produkcijskim zagonom

- [ ] Odstrani (ali pogojno onemogoči) debug middleware v [src/app.js](src/app.js#L20-L26), ki v loge izpisuje surov `Cookie` header (vsebuje session ID-je uporabnikov). Trenutno pustimo, ker ni pravih uporabnikov — obvezno odstraniti pred javnim zagonom za prava društva.
- [ ] Google OAuth (`passport-google-oauth20`, že v kodi) — dokončaj konfiguracijo in registriraj produkcijski redirect URI (`https://app.delomer.top/api/users/auth/google/callback`) v Google Cloud Console. Namenoma odloženo, dokler aplikacija ni bolj izpopolnjena.

## Arhitekturne odločitve, ki odstopajo od prvotnega Jira načrta

- **Multi-tenancy**: Jira epic KAN-6 (Tenancy & Whitelabel) je predvidel ločeno subdomeno na društvo (`abc.delomer.top`). Namesto tega smo se odločili za **eno domeno + tri nivoje vlog** (glej spodaj) — enostavnejše za trenutno fazo, brez wildcard DNS/TLS kompleksnosti. Subdomene ostajajo možna nadgradnja, če bo produkt zrasel.
- **Vloge in registracija (POMEMBNO — druga iteracija)**: Prvi poskus (registracija z izbiro "ustvari/pridruži se društvu") je bil **opuščen** v korist invite-only modela s tremi vlogami:
  - **SUPER_ADMIN** — ustvarja nova društva (ime + prvi admin), edini brez `organization_id`
  - **ADMIN** (društva) — vabi člane po emailu (posamič ali bulk: `Ime,Priimek,Email` na vrstico), vidi/ureja dela vseh članov društva, potrjuje/zavrača dela, upravlja kategorije dela (Faza 2)
  - **MEMBER** — se aktivira preko povezave iz vabila (`set-password.html?token=...`), vnaša svoja dela in ureja tista, ki jih je sam ustvaril
  - Ni več javne registracije. Nov uporabnik nastane samo, ko ga povabi ADMIN/SUPER_ADMIN (vrstica v `users` z `password_hash=''` in `invite_token`); ob aktivaciji nastavi geslo.
  - Email pošiljanje je za zdaj samo stub — povezava za nastavitev gesla se izpiše v strežniške loge (`src/utils/invites.js`), pravo pošiljanje (SMTP/Resend/ipd.) je TODO.
  - Prvi SUPER_ADMIN nastane ročno z SQL (`UPDATE users SET role='SUPER_ADMIN' WHERE email=...`, glej [migrations/002_super_admin_and_invites.sql](migrations/002_super_admin_and_invites.sql)), ne preko kode.
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
- [x] RBAC guards (`src/middleware/roles.js`: `requireAuth`, `requireRole`) — uporabljeno na `/api/admin/*` (ADMIN) in `/api/superadmin/*` (SUPER_ADMIN)
- [x] Admin vabi uporabnike (posamič + bulk), vidi seznam članov z aktivacijskim statusom — `POST/GET /api/admin/users`, `POST /api/admin/users/bulk`
- [ ] Admin lahko uporabnika tudi deaktivira / mu spremeni vlogo (trenutno samo dodajanje, ni CRUD)

### Epic: Work Logs — DRAFT → zaključi (KAN-8)
- [ ] Admin upravlja kategorije dela (CRUD, po društvu) — USER jih izbira iz spustnega menija ob vnosu dela
- [ ] Ustvari DRAFT z začetnim časom
- [ ] Uredi DRAFT (čas, tip dela, udeleženci, gostje)
- [ ] Skupinski vnos z minutami po udeležencu (override), gostje se ne štejejo v statistiko
- [ ] "Zaključi" → prehod DRAFT/REJECTED → PENDING, zaklene zapis za člane
- [ ] Seznam "Moje aktivnosti" s filtri (status, obdobje)

### Epic: Approvals (KAN-9)
- [ ] Admin approval queue (PENDING, filtri: obdobje/tip/creator)
- [ ] Potrdi zapis (PENDING → APPROVED, audit log)
- [ ] Zavrni zapis z obveznim razlogom (PENDING → REJECTED, član lahko popravi)
- [ ] Auto-approve cron job (PENDING starejši od 30 dni → APPROVED, `is_auto_approved=1`, idempotenten)

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

## Kasneje / nice-to-have

- [ ] Landing stran na glavni domeni `delomer.top` (app teče na `app.delomer.top`)
- [ ] Subdomena na društvo, če bo produkt zrasel (glej opuščeno KAN-6 zgoraj)

# TODO

Delovni seznam za nadaljnji razvoj na `dev` veji. `main` ostaja zamrznjen za predstavitev/zagovor — spremembe sem najprej speljemo skozi `dev`.

**Poganjanje migracij**: `./migrations/run.sh migrations/<ime>.sql` — bere uporabnika/geslo/bazo direktno iz okoljskih spremenljivk `db` kontejnerja (te že nastavi Docker Compose), zato ni potrebe po ročnem `grep`-anju gesla iz `.env` ali vnašanju gesla interaktivno. Starejši migracijski komentarji ("Zagon: ...") še vedno delujejo, a so ostali v stari, bolj okorni obliki.

Prvotni projektni načrt živi v Jira backlogu, izvožen v [ostalo/Jira.html](ostalo/Jira.html) (131 issue-jev, KAN-5 do KAN-135, vsi še v statusu Backlog). Ta datoteka povzema tisti načrt v obliki checklist-a in dodaja sprotne TODO-je iz razvoja/deploya, ki jih je smiselno reševati tekoče.

**Milestone branch**: `milestone-v1-poc` (ustvarjen iz `dev` na commit `82122aa`) je zamrznjen posnetek prvega delujočega proof-of-concept-a (vabila/vloge, vnos+potrjevanje dela, statistika, javni kiosk račun, člani brez računa, samopostrežna registracija) - namenjen za kasnejšo demonstracijo, ne za nadaljnji razvoj. `dev` se od te točke naprej razvija naprej z naslednjo fazo spodaj.

## Naslednja faza (po prvem POC-u)

- [ ] **Internacionalizacija (i18n)**: privzeto slovenščina, dodaj vsaj angleški prevod. Trenutno je vse besedilo trdo zapisano v slovenščini po `index.html`/`script.js` (labels, sporočila, `STATUS_LABELS`/`ROLE_LABELS` ipd.) - potrebna bo ločena struktura prevodov (npr. JSON slovar po jeziku) in izbirnik jezika, verjetno v uporabniških nastavitvah ali headerju.
- [ ] **Svetla/temna tema**: preklop teme, verjetno CSS custom properties (spremenljivke) namesto trdo zapisanih barv v `styles.css`, shranjevanje izbire (localStorage ali `users`/`app_settings`).
- [ ] **Landing stran na `www.delomer.top`**: ločena marketinška stran (opis aplikacije, kontaktni podatki) - `app.delomer.top` ostaja sama aplikacija. Verjetno ločen statični site/deploy, ne del tega Express projekta.
- [ ] **Uporabniška navodila**: navodila za uporabo aplikacije za končne uporabnike; posebej tudi kratka navodila/plakat za ob kiosku (javni PUBLIC račun) - fizični pripomoček ob tablici/računalniku v prostorih društva.
- [ ] **Responsive design za tablice/mobilne naprave**: trenutni layout (sidebar, tabele, forme) je bil zgrajen brez posebnega upoštevanja ozkih zaslonov - potreben pregled/prilagoditev za tablice in mobilnike, verjetno najprej pomembno za kiosk (ta pogosto teče na tablici) in "Vnos dela" na mobilnem telefonu.

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
  - Email pošiljanje: `src/utils/invites.js` zna pošiljati preko **Resend** (`RESEND_API_KEY`/`INVITE_EMAIL_FROM` v `.env`), a privzeto je način nastavljen na "log" (samo izpis povezave v loge) - SUPER_ADMIN v "Društva" → "Nastavitve" preklaplja med "log" in "real" (`app_settings.email_mode`, `GET/POST /api/superadmin/settings*`), brez potrebe po redeployu. Za pravo pošiljanje mora biti domena `delomer.top` verificirana pri Resend (SPF/DKIM/DMARC DNS zapisi).
  - Prvi SUPER_ADMIN nastane ročno z SQL (`UPDATE users SET role='SUPER_ADMIN' WHERE email=...`, glej [migrations/002_super_admin_and_invites.sql](migrations/002_super_admin_and_invites.sql)), ne preko kode.
  - Vabilo je veljavno **6 ur** (skrajšano iz prvotnih 7 dni — `INVITE_TOKEN_TTL_MS` v `src/utils/invites.js`). Če poteče, ADMIN/SUPER_ADMIN člana z gumbom "Ponovno pošlji vabilo" ponovno povabi s svežim 6-urnim tokenom (`POST /api/admin/users/:id/resend-invite`, `POST /api/superadmin/organizations/:id/users/:userId/resend-invite`).
  - SUPER_ADMIN lahko v "Admini društev" zdaj tudi ureja ime/priimek/email člana katerekoli društva (`PUT /api/superadmin/organizations/:id/users/:userId`), ne samo vlogo.
  - **Pravice so trenutno samo dvo-nivojske sklope** (`requireRole("ADMIN","SUPERINTENDENT")` vs `requireRole("ADMIN")`), ne granularen permission sistem. Eksplicitno dogovorjeno, da se bo to še razširilo, ko bo jasno kdo natančno sme kaj — glej spodaj.
- **UI**: aplikacija je iz ene monolitne strani prestrukturirana v sidebar/burger meni (`#sidebar`, `.nav-link[data-view]` + `.view` sekcije v [src/public/index.html](src/public/index.html), routing v `showView()` v [src/public/script.js](src/public/script.js)). Nav linki se filtrirajo po `data-roles` glede na vlogo prijavljenega uporabnika. Burger gumb (☰, skrajno levo v headerju) je toggle, stanje odprto/zaprto si zapomni v `localStorage` (per-brskalnik, ne na strežniku). Sidebar je `position: fixed` overlay na skrajnem levem robu zaslona (ne flex-sibling od contenta), zato se content ne oži, ko je meni odprt.
- **Urejanje člana**: namesto `prompt()` poziva se ob kliku na ✏️ inline razširi panel znotraj vrstice člana (ime/priimek/email + Shrani/Prekliči), glej `.member-edit-panel` v `renderOrgMember()`.
- **Zavrnitev dela**: enako inline (namesto `prompt()`) - `.reject-panel` v `renderAdminWorkItem()`. `rejection_reason` se ob ponovni oddaji (REJECTED → PENDING po urejanju) NAMENOMA ne briše več (glej [src/routes/work.js](src/routes/work.js)) - dokler je status PENDING in `rejection_reason` ni prazen, se poleg PENDING prikaže značka "popravljeno po zavrnitvi" (`.status-CORRECTED`).
- **Kategorije dela**: preimenovanje je zdaj tudi inline (`.edit-panel` v `loadCategoriesAdmin()`), ne več `prompt()`.
- **Enoten barvni sistem** v celi aplikaciji: urejanje = modro (`.btn-edit`, `.edit-panel`), potrditev = zeleno (`.btn-approve`), zavrnitev = rdeče (`.btn-reject`, `.reject-panel`). Statusi PENDING/APPROVED/REJECTED se v UI prikažejo v slovenščini ("V obravnavi"/"Potrjeno"/"Zavrnjeno", glej `STATUS_LABELS`/`statusLabel()` v script.js) - interno (DB, CSS razredi `status-PENDING` ipd.) ostane angleški enum. Potrdi/zavrni gumba uporabljata monohromatske znake (✓/✗, ne emoji ✔️/✖️), da pravilno podedujeta belo barvo besedila na obarvani podlagi.
- **Filtri v "Potrjevanje dela"**: datumski razpon (od-do) + bližnjice Danes/Ta teden/Ta mesec/To leto, in filter po statusu (Vsi/V obravnavi/V obravnavi-popravljeno/Potrjeno/Zavrnjeno). Vse client-side nad že pridobljenim seznamom (`adminWorkCache`/`renderAdminWorkList()` v script.js) - brez sprememb na backendu, ker gre za majhno količino podatkov (eno društvo).
- **Deploy target**: Jira (KAN-103, KAN-104) je predvidel Azure + wildcard subdomeno. Trenutno imamo dva neodvisna deploy cilja: Azure VM prek GitHub Actions CI/CD (samo `main`, glej [.github/workflows/deploy.yml](.github/workflows/deploy.yml)) in doma TrueNAS SCALE (Nginx Proxy Manager + Cloudflare, domena `app.delomer.top`) za razvoj/testiranje na `dev` veji.
- **Auth**: koda trenutno uporablja `express-session` (cookie seja, `passport.session()`), medtem ko je KAN-35/40/41 predvideval JWT (userId/tenantId/role) + httpOnly refresh cookie. `jsonwebtoken` je sicer v odvisnostih, a se še ne uporablja za auth flow — preveriti, ali ostanemo pri sejah ali migriramo na JWT.
- **Člani brez računa (roster) + samopostrežna registracija + javni (kiosk) račun (tretja iteracija vlog/članstva)**: društvo pozna vse svoje člane (tudi tiste, ki nikoli ne bodo uporabljali aplikacije na daljavo), zato je `users.email` postal **neobvezen** (`NULL` dovoljen, unique ostane) — [migrations/012_public_roster_and_kiosk.sql](migrations/012_public_roster_and_kiosk.sql).
  - **Član brez emaila** (`email IS NULL`, `password_hash=''`) — admin ga doda samo z ime+priimek, bodisi posamič bodisi v bulku (`POST /api/admin/users/roster`, ločen od obstoječega email-vabila). Takoj je na voljo povsod, kjer se izbirajo sodelavci pri vnosu dela (`GET /api/work/organization-members` ni nikoli filtriral po aktivacijskem statusu, samo po `is_active`), ker je celoten sodelavci/statistika sloj že vedno deloval zgolj na `users.id`, ne na emailu.
  - **Samopostrežna registracija**: vsako društvo ima svojo registracijsko povezavo (`organizations.join_code` + `registration_enabled` toggle, "Nastavitve društva" → "Registracija"). Član brez emaila jo odpre (`/join.html?code=...`), poišče svoje ime na seznamu neregistriranih in si sam nastavi email + geslo (`GET/POST /api/users/join/:code(/claim)`) - takoj po tem je prijavljen. Koda gate-a dostop do seznama imen (namesto npr. odprtega iskanja po celotnem internetu); admin jo lahko kadarkoli regenerira (`POST /api/admin/organization/join-code/regenerate`), če se "uhaja". Namenoma **brez dodatne admin-potrditve** po registraciji (uporabnikova izbira med tremi ponujenimi variantami).
  - **Izbris uporabnika (SUPER_ADMIN, hibridni pristop)**: če uporabnik nima nobenega povezanega dela (ni ga ustvaril, ni bil sodelavec), se ob izbrisu zbriše v celoti (`DELETE FROM users`). Če ima kakršnokoli delo, se namesto tega **anonimizira** (ime/priimek → "Izbrisan uporabnik", email/geslo/slika/invite_token odstranjeni, trajno `is_active=0`) - obstoječe ure in statistika društva ostanejo nespremenjene za nazaj. Novo `users.is_deleted` ločuje to trajno stanje od navadne (de)aktivacije - anonimiziran uporabnik se v UI prikaže samo kot "Izbrisan uporabnik" brez možnosti urejanja/spremembe vloge. Deljena logika `deleteOrgUser()` v [src/routes/superadmin.js](src/routes/superadmin.js) - posamično (`DELETE /api/superadmin/organizations/:id/users/:userId`) in množično (`POST .../users/bulk-delete`). Migracija [migrations/013_super_admin_user_delete.sql](migrations/013_super_admin_user_delete.sql).
  - **Množično urejanje v "Admini društev" (SUPER_ADMIN)**: checkbox na vsaki vrstici + "Označi vse", nato skupinsko nastavi vlogo (`POST /api/superadmin/organizations/:id/users/bulk-role`) ali izbriši (`bulk-delete`, isti hibridni pristop kot posamični izbris) izbranim naenkrat.
  - **Vloga PUBLIC (javni/kiosk račun)**: deljen račun za en fizični vhodni pripomoček v prostorih društva (tablica/računalnik), ki ga administrator ustvari enako kot navadno vabilo (email + `role: PUBLIC` checkbox v obrazcu "Povabi člana"). V UI ima na voljo **samo "Vnos dela"** (`data-roles` na nav-linku). Ne šteje se sam kot sodelavec pri delu, ki ga vnese (izrecno izločen v `POST/PUT /api/work`), niti se ga ne da izbrati kot sodelavca nekoga drugega ali dodati v ekipo (`role != 'PUBLIC'` v `/api/work/organization-members`, `resolveOrgParticipants()`, `setTeamMembers()`) - ker ni oseba, ki opravlja delo, ampak samo vhodna točka zanj. Lahko izbira med vsemi člani društva (vključno s tistimi brez emaila) in celotnimi ekipami naenkrat (obstoječi "+ Dodaj ekipo" quick-add v vnosu dela je s tem že rešil zahtevo "ni treba klikati vsakega posebej").

## Backlog (iz Jira, povzeto po epicih)

### Epic: Foundations (KAN-5)
- [ ] Repo scaffold + monorepo struktura (`/apps/api`, `/apps/web`, `/docs`, `/infra`) — *trenutno je repo enoten Express projekt, ne monorepo; preveriti, ali je monorepo še relevanten*
- [ ] Environment configuration (dev/staging/prod) — seznam env spremenljivk dokumentiran v `/docs`
- [ ] Healthcheck endpoint — **narejeno**, `GET /health` že obstaja v [src/app.js](src/app.js#L130-L132)

### Epic: Tenancy & Whitelabel (KAN-6)
*(glej arhitekturno odločitev zgoraj — subdomene opuščene, model je zdaj SUPER_ADMIN/ADMIN/MEMBER z vabili)*
- [x] Podatkovni model: `organizations` tabela + `users.organization_id`/`users.role` (SUPER_ADMIN/ADMIN/MEMBER) + `invite_token`
- [x] SUPER_ADMIN ustvarja društva + prvega admina (`POST /api/superadmin/organizations`) in jih ureja/preimenuje inline (`PUT /api/superadmin/organizations/:id`)
- [ ] Tenant isolation na work-log/reporting endpointih (work.js še ne filtrira po `organization_id`, samo po `user_id` — ni nujno narobe dokler ni skupinskih/admin pogledov čez več uporabnikov, a preveriti pri Fazi 2)
- [ ] Public tenant branding endpoint (logo/barve društva)
- [ ] Tenant settings admin UI (admin ureja logo/barve, member read-only)

### Epic: Auth & User (KAN-7)
- [x] Password login, brez razkrivanja obstoja uporabnika (+ popravljen bug: login/register nista več vračala `password_hash` na frontend)
- [x] RBAC guards (`src/middleware/roles.js`: `requireAuth`, `requireRole`) — `requireRole("ADMIN","SUPERINTENDENT")` na delo/kategorije/potrjevanje, `requireRole("ADMIN")` samo na upravljanje uporabnikov, `requireRole("SUPER_ADMIN")` na `/api/superadmin/*`
- [x] Admin vabi uporabnike (posamič + bulk), vidi seznam članov z aktivacijskim statusom — `POST/GET /api/admin/users`, `POST /api/admin/users/bulk`
- [x] Admin ureja podatke člana (ime/priimek/email) — `PUT /api/admin/users/:id`
- [x] Admin (ne pa SUPERINTENDENT) spreminja vlogo člana do vključno ADMIN — `POST /api/admin/users/:id/role`; SUPER_ADMIN enako za katerokoli društvo — `POST /api/superadmin/organizations/:id/users/:userId/role`
- [x] "Člani" je zdaj razdeljen na pod-zavihka **Prikaz** (branje - dovoljeno ADMIN in SUPERINTENDENT) in **Dodajanje** (invite/bulk - samo ADMIN). Klik na ime člana v seznamu odpre njegov profil (`GET /api/admin/users/:id`) z grafom njegove statistike dela (`GET /api/admin/users/:id/stats`) - na voljo tako ADMIN-u kot SUPERINTENDENT-u.
- [x] "Prikaz članov": iskanje po imenu/priimku, filter po statusu (aktiven/neaktiven/brez emaila/čaka aktivacijo, večizboren) in vlogi (vključno s PUBLIC, večizboren), sort A-Ž/Ž-A po imenu ali priimku (`adminMembersCache`/`renderOrgMembersList()`); neaktivni člani so vedno pomaknjeni na dno seznama ne glede na izbrano razvrščanje. Status/vloga sta zdaj isti spustni-seznam-s-kljukicami vzorec kot pri statistiki (`setupDropdownCheckFilter()`) - prazna izbira = "vsi", en član lahko hkrati pade v dva statusa (npr. aktiven + čaka aktivacijo), ujemanje je OR med izbranimi kljukicami. Enak vzorec uporablja tudi "Admini društev" (`orgAdminsStatusPanel`/`orgAdminsRolePanel`).
- [x] "Ekipe" enako razdeljene na pod-zavihka (Ekipe / Dodajanje ekip); pod-zavihek sistem je posplošen (`data-subtab-panel`, deluje za katerikoli view, ne le za Člane). Izbira članov ekipe ima zdaj enako iskanje/sort kot pri "Vnos dela" (`teamMembersCache`/`teamSelectedMemberIds`, robustno tudi ko je iskalni filter aktiven med urejanjem obstoječe ekipe).
- [x] Admin lahko uporabnika deaktivira/aktivira (`users.is_active`, `POST /api/admin/users/:id/(de)activate`) — deaktiviran uporabnik ne more dodajati dela (`POST /api/work` vrne 403) in ga drugi ne morejo dodati kot sodelavca (izločen iz `GET /api/work/organization-members` in `resolveOrgParticipants`); prijava sama ni blokirana (namenoma - ni bilo zahtevano). V "Člani" je tak uporabnik prikazan osivel, sprememba vloge in (de)aktivacija sta zdaj dostopni samo znotraj edit panela (ne več inline v vrstici).
- [x] Vloge prevedene v slovenščino za prikaz (`ROLE_LABELS`/`roleLabel()`): SUPER_ADMIN → "Super administrator", ADMIN → "Administrator", SUPERINTENDENT → "Nadzornik", MEMBER → "Član". Interno (DB, `value` atributi, RBAC) ostane angleški enum.
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
- [x] Gostje/člani brez računa — implementirano drugače kot prvotno predvideno: namesto ločenega "gost" koncepta, ki ne šteje v statistiko, je to zdaj **polnopravna vrstica v `users`** (`email IS NULL`), ki v statistiki šteje enako kot vsak drug član (glej arhitekturno odločitev "Član brez emaila" zgoraj) - ker je društvo želelo, da se ure takim članom dejansko beležijo, ne le "brezimensko" prikazujejo
- [ ] Filtri po statusu/obdobju na seznamu

### Epic: Approvals (KAN-9)
- [x] Admin approval queue — `GET /api/admin/work` (vsi vnosi društva, PENDING najprej)
- [x] Potrdi zapis (PENDING → APPROVED) — `POST /api/admin/work/:id/approve`
- [x] Zavrni zapis z obveznim razlogom (PENDING → REJECTED) — `POST /api/admin/work/:id/reject`, ki ob uspehu pošlje ustvarjatelju vnosa **email z razlogom zavrnitve** (`sendWorkRejectedEmail()` v `src/utils/invites.js`, isti `deliverEmail()`/log-ali-real mehanizem kot ostala pošta); tiho preskočeno, če ustvarjatelj nima nastavljenega emaila (npr. član brez računa)
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

## Nastavitve uporabnika in društva

- [x] **Moj profil**: zobnik (⚙️) ob "Osebni podatki" odpre inline panel (`.edit-panel`) za spremembo profilne slike (premaknjeno sem iz prejšnjega ločenega gumba), gesla (staro geslo + novo dvakrat, mora se ujemati, brez preverjanja jakosti - namenoma odloženo do prave produkcije) in emaila. `POST /api/users/me/password`, `PUT /api/users/me/email`. Ime/priimek NI urejljivo s strani uporabnika - to lahko spremeni samo ADMIN/SUPER_ADMIN (obstoječa funkcionalnost).
  - Sprememba gesla: **obvezna odjava** (`req.logout` + `req.session.destroy`), frontend po uspehu naredi `location.reload()`, ki uporabnika vrne na prijavo. Poleg tega se pošlje **varnostni email** ("Vaše geslo je bilo spremenjeno" + povezava za takojšnjo ponastavitev, 6h veljavna, isti `invite_token` mehanizem kot vabila) - `sendPasswordChangedEmail()` v `src/utils/invites.js` (refaktorirano: skupna `deliverEmail()` za vabila in varnostna obvestila).
  - **Zgodovina prijav** ("Zadnje prijave", zadnjih 10): IP naslov (prednost `CF-Connecting-IP` iz Cloudflare pred `req.ip`), groba lokacija (`geoip-lite`, offline baza, brez zunanjih API klicev) in brskalnik/OS (`ua-parser-js`). Zapisuje se ob vsaki uspešni prijavi in aktivaciji računa (`recordLogin()` v `src/utils/loginHistory.js`, nova tabela `login_history`, `GET /api/users/me/login-history`).
- [x] **"Nastavitve društva"** (nov sidebar item, ADMIN only) — razdeljeno na pod-zavihka **Splošno** in **Funkcionarji**. Splošno: logotip društva (upload, `uploads/logos/`, isti vzorec kot avatar), ime in opis društva, **način obračunavanja/prikaza ur** (glej spodaj), + par onemogočenih placeholder togglov/select-a ("kmalu") kot vizualna osnova za prihodnje nastavitve (`.toggle-switch` - nov reusable komponent). `GET/PUT /api/admin/organization`, `POST /api/admin/organization/logo`.
- [x] **Funkcionarji društva** — CRUD (`/api/admin/officials`): ime, priimek, funkcija (obvezno) + telefon/email/WhatsApp/Viber/Telegram (vsi neobvezni, prikažejo se samo izpolnjena polja). Urejanje po istem vzorcu kot Ekipe (klik ✏️ napolni skupni obrazec, gumb postane "Posodobi"). Zdaj v lastnem pod-zavihku (prej skupaj z Splošno).
- [x] **Način obračunavanja/prikaza ur** (na nivoju društva): zaokroževanje na X minut (`organizations.hour_rounding_minutes`, poljubna vrednost - npr. 6 min za decimalno society, 60 za samo cele ure) + format prikaza (`hour_display_format`: DECIMAL "8.5 h" / WHOLE "8 h" / DHM "1d 2h 30min"). Namensko implementirano samo kot **prikazna** plast (`formatHours()`/`loadOrgHourSettings()` v script.js, `GET /api/work/organization-settings` dostopen vsem članom društva) - surovi podatki (minute) v bazi ostanejo nespremenjeni, zaokroževanje/format se uporabita samo pri izpisu (seznami dela, statistika, "ure po članih/društvih"). Grafi (Chart.js) namenoma ostanejo v surovih decimalnih urah, ker DHM/WHOLE format ni smiseln za zvezno os.
- Migracije [migrations/009_org_settings_and_user_account.sql](migrations/009_org_settings_and_user_account.sql) (`organizations.logo_path`/`description`, nova tabela `organization_officials`) in [migrations/010_hour_accounting_settings.sql](migrations/010_hour_accounting_settings.sql) (`hour_rounding_minutes`/`hour_display_format`).

## Statistika in profil

- [x] **Moj profil** (vsi uporabniki) — ime/priimek/email/društvo (samo prikaz, brez urejanja), profilna slika (upload preko `POST /api/users/me/avatar`, multer, shranjeno v `uploads/avatars/` - **trajen Docker volumen `uploads_data:/app/uploads`**, ne v `src/public` ker bi se ob vsakem `--build` izgubilo), graf opravljenih ur skozi čas (`GET /api/users/me/stats?from&to`, Chart.js, privzeto zadnji mesec) — glej [migrations/006_avatar_and_profile_stats.sql](migrations/006_avatar_and_profile_stats.sql)
- [x] "Statistika društva" (ADMIN/SUPERINTENDENT) — `GET /api/admin/stats?from&to&statuses&category_ids&team_ids`: graf ur skozi čas (`renderHoursChart`, deljena z "Moj profil"), skupno število ur, in razčlenitev po članih (padajoče). Filtri: datumski razpon + bližnjice (enako kot Potrjevanje dela); status/kategorije/ekipe so vsi trije **spustni seznami z več kljukicami** (`.dropdown-check-filter`/`setupDropdownCheckFilter()` v script.js — generična komponenta, prazna izbira = "vse", gumb prikaže "Vse" ali "N izbranih"). Status je s tem postal tudi večizboren (prej samo eno vrednost).
- [x] "Statistika društev" (SUPER_ADMIN) — `GET /api/superadmin/stats?from&to&statuses&organization_ids`: enak pristop kot "Statistika društva", brez `organization_id` omejitve, z razčlenitvijo **po društvih** namesto po članih; filter "Društva" je isti spustni-seznam-s-kljukicami vzorec (kategorije/ekipe niso vključene, ker so per-društvo koncept, ne smiselni čez več društev hkrati).
- [x] "Ure po članih"/"po društvih": dodan vnos "Prikaži top N" (privzeto 10), reže prikazan seznam na N najboljših.
- [x] Slovensko sklanjanje "član" (1 član / 2 člana / 3-4 člani / 5+ oz. 11-14 članov) — `memberCountLabel()` v script.js, uporabljeno pri številu članov društva in ekipe.
- [x] "Admini društev": dodano iskanje po imenu/priimku + filter po statusu/vlogi + sort A-Ž/Ž-A, enak vzorec kot pri ADMIN-ovem "Prikaz članov" (`orgAdminsMembersCache`/`renderOrgAdminsList()`), plus prikaz (deaktiviran) in sivo za neaktivne člane.
- **Prihodnja arhitekturna sprememba (dogovorjeno, ne zdaj)**: uporabnik trenutno pripada natanko enemu društvu (`users.organization_id`, striktna 1:1). V prihodnosti načrtovana nadgradnja na možnost, da je en uporabnik član več društev hkrati - to bo zahtevalo many-to-many model (ločena tabela članstev z vlogo per-društvo) in posege v RBAC/delo/potrjevanje. Namenoma odloženo dokler ne bo dejansko potrebno.

## Kasneje / nice-to-have

- [ ] Landing stran na glavni domeni `delomer.top` (app teče na `app.delomer.top`)
- [ ] Subdomena na društvo, če bo produkt zrasel (glej opuščeno KAN-6 zgoraj)

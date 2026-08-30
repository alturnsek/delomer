# Navodila za uporabo — Delomer

Ta navodila razlagajo, kako se v aplikaciji Delomer registrirati, prijaviti, vnašati opravljeno delo ter (za administratorje in nadzornike) upravljati društvo. Za kratka navodila ob kiosku (skupnem računu na tablici/računalniku v prostorih društva) glej [src/public/kiosk-navodila.html](../src/public/kiosk-navodila.html) — namenjena so tisku in obešanju ob napravi.

## Kazalo

1. [Kaj je Delomer](#1-kaj-je-delomer)
2. [Kako dobim dostop](#2-kako-dobim-dostop)
3. [Vnos opravljenega dela](#3-vnos-opravljenega-dela)
4. [Urejanje in brisanje lastnih vnosov](#4-urejanje-in-brisanje-lastnih-vnosov)
5. [Status vnosa in samodejna potrditev](#5-status-vnosa-in-samodejna-potrditev)
6. [Moj profil](#6-moj-profil)
7. [Vloge v aplikaciji](#7-vloge-v-aplikaciji)
8. [Za administratorje in nadzornike](#8-za-administratorje-in-nadzornike)
9. [Samo za administratorje: nastavitve društva](#9-samo-za-administratorje-nastavitve-društva)
10. [Javni (kiosk) račun](#10-javni-kiosk-račun)
11. [Pogosta vprašanja](#11-pogosta-vprašanja)

---

## 1. Kaj je Delomer

Delomer je spletna aplikacija za društva in klube, v katero člani vnašajo opravljeno prostovoljno delo (sestanki, akcije, dežurstva, vzdrževanje ...). Upravni odbor vnose pregleda in potrdi, društvo pa ima vedno na voljo pregledno statistiko, koliko ur so člani skupaj prispevali.

Aplikacija je dostopna na naslovu **app.delomer.top**.

## 2. Kako dobim dostop

Registracija ni javna — do aplikacije dostopate na enega od dveh načinov:

### a) Vabilo po emailu

Administrator vas doda v sistem in na vaš email prejmete povezavo z naslovom "Povabilo v Delomer". Povezava je veljavna **6 ur**. Ob kliku nastavite geslo (vsaj 6 znakov) in ste takoj prijavljeni.

Če povezava poteče, prosite administratorja, naj klikne "Ponovno pošlji vabilo" pri vašem imenu.

### b) Samopostrežna registracija (registracijska povezava društva)

Nekatera društva vnaprej dodajo seznam vseh svojih članov, tudi tistih brez emaila. Če ste na takem seznamu, vas administrator napoti na skupno **registracijsko povezavo društva** (npr. objavljeno na oglasni deski ali v skupini na WhatsAppu). Na tej strani:

1. Poiščete svoje ime na seznamu.
2. Vnesete svoj email in si izberete geslo.
3. Ste takoj prijavljeni kot pravi uporabnik.

### Prijava

Na naslovu app.delomer.top vnesete email in geslo. Če ste pozabili geslo, se za ponastavitev obrnite na administratorja društva (funkcija samostojne ponastavitve gesla iz strani za prijavo trenutno ni na voljo — geslo lahko spremenite sami šele, ko ste že prijavljeni, v "Moj profil").

## 3. Vnos opravljenega dela

V meniju izberite **"Vnos dela"**:

1. **Kaj si delal?** — kratek opis (do 255 znakov).
2. **Začetek dela** in **Konec dela** — datum in ura.
3. **Kategorija** (neobvezno) — če jih je društvo določilo (npr. "Vaje", "Tekmovanja", "Sestanki").
4. **Sodelavci** — če ste delo opravljali skupaj z drugimi člani, jih odkljukajte s seznama. Seznam lahko filtrirate z iskanjem po imenu/priimku in razvrščate po abecedi. Če je bila zraven cela ekipa, jo dodate naenkrat z **"+ Dodaj ekipo"**, namesto da bi vsakega člana kljukali posebej.
5. Za posameznega sodelavca lahko po potrebi ročno popravite število minut (npr. če je prišel kasneje ali odšel prej) — to polje se prikaže ob izbiri sodelavca.
6. Kliknite **"+ Dodaj"**.

Vnos dobi status **"V obravnavi"**, dokler ga administrator ali nadzornik ne pregleda.

## 4. Urejanje in brisanje lastnih vnosov

Dokler vnos ni **potrjen**, ga lahko ustvarjalec (in samo on) uredi ali izbriše s pripadajočima gumboma pri vnosu v seznamu pod obrazcem za vnos dela. Potrjenega vnosa ni več mogoče spreminjati — če je prišlo do napake, se obrnite na administratorja ali nadzornika.

Če je bil vnos **zavrnjen**, ga lahko popravite in ponovno oddate — po urejanju se samodejno vrne v status "V obravnavi".

## 5. Status vnosa in samodejna potrditev

- **V obravnavi** — čaka na pregled.
- **Potrjeno** — administrator/nadzornik je vnos odobril, šteje se v statistiko društva.
- **Zavrnjeno** — vnos je bil zavrnjen z razlogom (viden ob vnosu). Ob zavrnitvi prejmete tudi email z razlogom, če imate nastavljen email.

Vnosi, ki ostanejo nepregledani **30 dni**, se samodejno potrdijo.

## 6. Moj profil

V meniju "Moj profil" imate:

- **Osebni podatki** — ime, priimek, email, društvo. Ime in priimek lahko spremeni samo administrator; email in geslo pa lahko spremenite sami preko zobnika (⚙️) ob "Osebni podatki".
  - **Sprememba gesla** vas iz varnostnih razlogov **samodejno odjavi** in vam pošlje email z obvestilom (če bi sprememba prišla od nekoga drugega, lahko preko povezave v tem emailu takoj ponastavite geslo).
  - **Sprememba emaila** je takojšnja, brez potrditvenega emaila.
  - **Profilna slika** — poljubna slika, ki se prikazuje ob vašem imenu.
- **Statistika dela** — graf vaših potrjenih ur skozi izbrano obdobje.
- **Zadnje prijave** — zadnjih 10 prijav v vaš račun z IP naslovom, približno lokacijo in brskalnikom — koristno za preverjanje, da se v vaš račun ni prijavil nekdo drug.

## 7. Vloge v aplikaciji

| Vloga | Kaj lahko dela |
|---|---|
| **Super administrator** | Ustvarja nova društva in njihove prve administratorje. Ne pripada nobenemu društvu. |
| **Administrator** | Vse operativne pravice (spodaj) + vabi/ureja/briše člane, jim spreminja vlogo, upravlja nastavitve društva. |
| **Nadzornik** | Enako kot administrator pri delu, kategorijah, ekipah, potrjevanju in statistiki - **ne more** upravljati članov (vabiti, urejati, brisati, spreminjati vlog). |
| **Član** | Vnaša svoje delo, ureja svoje vnose, vidi svoj profil in statistiko. |
| **Javni (kiosk)** | Glej [poglavje 10](#10-javni-kiosk-račun) spodaj. |

## 8. Za administratorje in nadzornike

### Potrjevanje dela

V meniju "Potrjevanje dela" vidite vse vnose društva. Filtrirate lahko po datumu (z bližnjicami Danes/Ta teden/Ta mesec/To leto) in statusu. Vsak vnos lahko:

- **Potrdite** (✓) — vnos šteje v statistiko.
- **Zavrnete** (✗) — obvezno morate navesti razlog; ustvarjalec o tem prejme email.
- **Uredite** — spremenite čas, kategorijo ali sodelavce, tudi za vnose drugih članov.

### Upravljanje članov (samo administrator)

V meniju "Člani", pod-zavihek "Dodajanje", lahko:

- **Povabite posameznega člana** — ime, priimek, email; po želji ga označite kot **"Javni (kiosk) račun"**.
- **Povabite več naenkrat** — vsaka vrstica po vzorcu `Ime,Priimek,Email`.
- **Dodate člane brez emaila** — samo za seznam (izbira med sodelavci), vsaka vrstica po vzorcu `Ime,Priimek`. Ti člani se lahko kasneje sami registrirajo (glej [poglavje 2b](#b-samopostrežna-registracija-registracijska-povezava-društva)).

V pod-zavihku "Prikaz članov" iščete, filtrirate (status, vloga) in razvrščate seznam. Klik na ✏️ pri članu odpre urejanje: ime/priimek/email, vlogo, (de)aktivacijo in ponovno pošiljanje vabila.

**Deaktivacija** članu prepreči vnašanje dela in izbiro kot sodelavca, ne prepreči pa prijave — uporablja se npr. za člane, ki so začasno neaktivni.

### Kategorije dela

V meniju "Kategorije" dodajate/preimenujete kategorije. Namesto brisanja jih **deaktivirate** — stari vnosi kategorijo ohranijo, nova pa ni več na voljo pri vnosu dela.

### Ekipe

V meniju "Ekipe" ustvarite poimenovano skupino članov (npr. "Mladinska ekipa"), da jih lahko pri vnosu dela dodate vse naenkrat namesto posamično.

### Statistika društva

Graf in skupno število ur, s filtri po obdobju, statusu, kategorijah in ekipah (vsi so večizborni spustni seznami s kljukicami). Spodaj je razčlenitev ur po posameznih članih, z nastavljivim prikazom "Top N" najboljših.

## 9. Samo za administratorje: nastavitve društva

V meniju "Nastavitve društva":

- **Splošno** — logotip, opis društva, način obračunavanja/prikaza ur (zaokroževanje na X minut, prikaz v decimalnih urah / celih urah / dnevi-ure-minute).
- **Funkcionarji** — kontaktni podatki predsednika, tajnika ipd. (telefon, email, WhatsApp, Viber, Telegram — vsi neobvezni).
- **Registracija** — tu je registracijska povezava društva za samopostrežno registracijo (glej [poglavje 2b](#b-samopostrežna-registracija-registracijska-povezava-društva)), stikalo za njen vklop/izklop, in gumb za ustvarjanje nove povezave (stara takrat preneha delovati — uporabite, če je povezava prišla v napačne roke).

## 10. Javni (kiosk) račun

Ne potrebuje vsak član svojega računa. Društvo lahko namesto tega vzpostavi en skupni račun na tablici ali računalniku v svojih prostorih ("javni" oz. "kiosk" račun), na katerem lahko kdorkoli, ki je bil prisoten, vnese opravljeno delo.

Ta račun v meniju vidi **samo "Vnos dela"**, nič drugega. Vidi vse člane društva (tudi tiste brez lastnega računa) in ekipe za izbiro sodelavcev, sam pa se ne šteje kot sodelavec vnesenega dela.

Za natis kratkih navodil ob napravi glej [src/public/kiosk-navodila.html](../src/public/kiosk-navodila.html).

## 11. Pogosta vprašanja

**Nisem dobil/a vabila po emailu.**
Preverite mapo za neželeno pošto (spam). Če ga res ni, prosite administratorja, naj preveri, ali je email pravilno vnešen, in klikne "Ponovno pošlji vabilo".

**Povezava za nastavitev gesla je potekla.**
Povezave so veljavne 6 ur. Prosite administratorja za novo (ali, če ste se registrirali preko registracijske povezave društva, poskusite postopek ponoviti).

**Pozabil/a sem geslo.**
Samostojne ponastavitve s strani za prijavo trenutno ni — obrnite se na administratorja društva.

**Ne vidim določenega menija (npr. "Statistika društva").**
Meniji so prilagojeni vaši vlogi — člani npr. ne vidijo administratorskih menijev. Če menite, da bi jih morali videti, se obrnite na administratorja.

**Zakaj ne morem urediti potrjenega vnosa?**
Potrjeni vnosi so zaklenjeni, da se statistika društva ne spreminja za nazaj. Za popravek se obrnite na administratorja ali nadzornika, ki lahko uredi katerikoli vnos v društvu.

# Voimatreeni

Suomenkielinen, tumma ja puhelimella käytettävä kuntosalipäiväkirja. React + TypeScript + Vite. Ei palvelinta, käyttäjätilejä tai ulkoisia API-palveluja.

## Ominaisuudet

- Nimetyt ohjelmat, liikkeiden lisäys/poisto/järjestys, sarjat, tavoitetoistot ja palautusajat.
- Kahden liikkeen supersetit: palautus alkaa vasta, kun parin molemmat vastaavat sarjat on kuitattu. Liikkeet näkyvät ohjelman järjestyksessä; järjestä pari halutessasi peräkkäin.
- Sarjojen painot ja toteutuneet toistot, yhden painalluksen kuittaus sekä palautusajastin.
- Edellisen kirjatun harjoituksen liikekohtaiset painot ja toistot ehdotuksina. Keskeneräinen treeni tallentuu automaattisesti.
- Historia, suurimman sarjapainon graafi, Epleyn 1RM-arvio ja tehtyjen sarjojen volyymi.
- IndexedDB-tallennus sekä JSON-vienti ja -palautus. Palautus tarkistetaan ennen nykyisten tietojen korvaamista.
- Asennettava PWA, paikalliset kuvakkeet ja offline-välimuisti.

Mukana on muokattavat esimerkkiohjelmat Voima A ja Voima B. Ne ovat lähtöpohjia, eivät henkilökohtainen harjoitusohje.

## Käynnistys

Tarvitset Node.js 22 tai uudemman ja npm:n.

```sh
cd /workspace/SamuelPokala.github.io
npm ci
npm run dev
```

Avaa Viten ilmoittama osoite selaimessa. Kehityspalvelin on tavallisesti portissa 5173. PWA ja offline-toiminta tarkistetaan tuotantoversiolla:

```sh
npm run build
npm run preview -- --port 4173
```

`npm run build` tarkistaa TypeScriptin ja luo `dist/`-hakemistoon julkaisuvalmiin sivuston. `npm run preview` on paikallinen tarkistuspalvelin.

## Testit

```sh
npm test
npm run build
```

Vitest testaa volyymilaskennan, Epleyn kaavan, edellisen treenin ehdotukset ja varmuuskopioiden validoinnin.

Laajempi selaintesti edellyttää Pythonin Playwright-pakettia ja Chromiumia. Tässä pilviympäristössä molemmat ovat valmiina. Käynnistä ensin tuotantoversion esikatselu porttiin 4173, sitten:

```sh
python3 tests/smoke.py
```

Testi käyttää erillistä mobiilikokoista selainkontekstia ja tarkistaa ohjelman luomisen, järjestyksen, supersetin, ajastimen, treenin tallennuksen, IndexedDB:n säilymisen uudelleenlatauksessa, 1RM:n, volyymin, viennin, palautuksen, ehdotukset ja offline-käynnistyksen. Muulla koneella asenna Playwright erilliseen Python-virtuaaliympäristöön ja muuta tarvittaessa testin Chromium-polku. Testille voi antaa esikatselun URL:n argumenttina, esimerkiksi alihakemistopolun.

## Julkaisu GitHub Pagesiin

Repositorio sisältää `.github/workflows/pages.yml`-työnkulun. Valitse GitHubissa **Settings → Pages → Source → GitHub Actions**. Vie muutokset `main`-haaraan tai käynnistä työnkulku käsin. Työnkulku asentaa lukitut riippuvuudet, ajaa yksikkötestit, rakentaa sovelluksen ja julkaisee `dist/`-hakemiston.

Viten suhteellinen `base: './'` mahdollistaa myös repositorion alihakemistoon julkaisemisen. Julkaistu sovellus tarvitsee HTTPS:n PWA:ta varten. Voit käyttää mitä tahansa staattista HTTPS-hostingia ja julkaista sinne koko `dist/`-hakemiston. Älä julkaise lähdekansiota suoraan ilman koontia.

## Asentaminen puhelimelle ja offline-käyttö

1. Avaa julkaistu HTTPS-sivu verkkoyhteyden ollessa käytössä. Ensimmäinen lataus tarvitsee verkon.
2. Odota ilmoitusta, että sovellus on valmis offline-käyttöön.
3. Android / Chrome: valitse selaimen valikosta **Asenna sovellus** tai **Lisää aloitusnäyttöön**.
4. iPhone / Safari: valitse **Jaa → Lisää Koti-valikkoon**.
5. Avaa sovellus aloitusnäytöltä. Ohjelmat ja harjoitukset toimivat myös ilman verkkoa.

Service worker toimii HTTPS:llä ja localhostissa, ei tavallisella puhelimelta avatulla HTTP-lähiverkko-osoitteella. Asennusvalikon nimi voi vaihdella selaimittain. Sovellus ilmoittaa uudesta versiosta; päätä treeni ennen päivityksen hyväksymistä.

## Tietojen säilyminen

IndexedDB on selain-, laite- ja sivustokohtainen. Tiedot eivät synkronoidu. Selaintietojen poistaminen, yksityinen selaus tai selaimen tallennustilan tyhjennys voivat poistaa tiedot. Pidä JSON-varmuuskopio erillisessä turvallisessa paikassa. Osoitteen tai selaimen vaihtuessa vie tiedot ensin ja palauta ne uudessa ympäristössä.

Historiassa **Vie JSON-varmuuskopio** tallentaa ohjelmat, historian ja keskeneräisen treenin. **Palauta JSON-varmuuskopio** korvaa kaikki nykyiset tiedot vahvistuksen jälkeen. Sovellus ei automaattisesti siirrä vanhan Oma sali -version localStorage-tietoja: uuden version tietomalli ja varmuuskopiomuoto ovat erilaiset. Vanhan version tiedot jätetään selaimeen koskematta.

1RM on suuntaa antava arvio: `kg × (1 + toistot / 30)`; yhdelle toistolle käytetään kirjattua painoa. Volyymi on vain tehtyjen sarjojen `kg × toistot` -summa. Historiassa näet koko treenin volyymin, kehityksessä valitun liikkeen volyymin. Kirjaa käsipainoissa johdonmukaisesti joko yhteispaino tai yhden käsipainon paino.

Ajastin näyttää seinäkelloon perustuvan jäljellä olevan ajan myös välilehdelle palattaessa. Äänihälytystä tai taustailmoitusta ei ole, ja ajastin nollautuu sivun uudelleenlatauksessa. Keskeneräinen treeni säilyy. Käytä sovellusta yhdessä välilehdessä kerrallaan, sillä samanaikaisia muokkauksia ei yhdistetä.

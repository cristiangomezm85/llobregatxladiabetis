# Llistat d'imatges per a la web

Totes les imatges van a la carpeta `img/`. La web està preparada perquè, si una imatge encara no existeix, no es vegi trencada (cau silenciosament gràcies a `onerror` als `<picture>`). Per tant pots anar penjant-les progressivament.

## Convenció de mides

Faig servir el patró `<picture>` amb dues versions per a cada imatge:
- **Desktop**: format ample (16:9 o panoràmic), per a pantalles grans
- **Mobile**: format vertical o quadrat, per a pantalles petites

Això vol dir que **cada concepte d'imatge necessita dos fitxers**: un per desktop i un per mobile. La distinció és important perquè una imatge panoràmica retallada per a mòbil queda pèssima i una imatge quadrada estirada al hero d'un PC queda igual.

## Format i pes recomanats

- **JPG** per a fotografies (compressió al voltant del 80%, pes objectiu 150-300 KB)
- **PNG** només per a logos amb fons transparent
- Si tens dubtes amb una imatge complexa, JPG sempre serà més lleuger

## Sobre el retall de les imatges del hero

Els heroes de les pàgines són **contenidors més amples que alts** (panoràmics). Les imatges 1920×1080 que es generen amb DALL-E/ChatGPT són **lleugerament més quadrades** (proporció 16:9), per tant es retallaran una mica per dalt i baix. Això és normal i intencional: l'overlay blau també hi ajuda.

### Composició recomanada per a imatges del hero

| Tipus d'imatge | On posar el subjecte |
|---|---|
| Persones (cara/cap visible) | A l'altura del **terç central vertical** (entre el 30% i el 70% de l'alçada). Mai a la part superior. |
| Paisatge | El punt focal (riu, poble, sol) al **centre vertical o lleugerament al terç inferior**. |
| Silueta/figura completa | Centrada verticalment. |

**Per què**: per defecte les imatges es mostren centrades, i el hero retalla aproximadament el 25% superior i 25% inferior. Tot el que estigui a aquestes franges es perd.

### Si una imatge concreta no es veu bé

Cada imatge té un atribut `style="object-position: center XX%;"` al seu `<img>` que controla quina part vertical de la imatge es mostra. Pots editar el percentatge:

- `center 0%` o `center top` → mostra la part superior
- `center 25%` → mostra més la part de dalt (caras, capçaleres)
- `center 50%` o `center center` → centre (default si no es posa)
- `center 75%` → mostra més la part de baix
- `center 100%` o `center bottom` → mostra la part inferior

Configuració actual de cada pàgina:
- **herois.html**: `center 22%` (perquè els atletes tinguin el cap visible)
- **pobles.html**: `center 40%`
- **patrocina.html**: `center 45%`
- **index.html** (home): usa `background-position: center 60%` per a la versió mobile i `center 65%` per a desktop

---

## 1. Imatges ja existents al teu disc (no cal regenerar)

Aquestes són les que ja tens muntades a l'index.html. Les llisto per completitud:

| Fitxer | Ús |
|---|---|
| `img/logo-small.png` | Logo (nav, footer, splash, favicon) — usat a TOTES les pàgines |
| `img/hero-runner.jpg` | Hero de la home (versió mobile) |
| `img/hero-runner-full.png` | Hero de la home (versió desktop) |
| `img/font-llobregat.jpg` | Secció "El repte" — font del Llobregat |
| `img/mapa-rio.jpg` | Secció "Recorregut" — mapa del riu |
| `img/cristian.jpg` | Secció "Impulsor" — retrat de Cristian |
| `img/pare-fill.jpg` | Secció "Impulsor" — pare i fill caminant |
| `img/recerca.jpg` | Secció "La causa" — recerca científica |
| `img/aredi-logo.png` | Secció "La causa" — logo d'AREDI |
| `img/participacio.jpg` | Secció "Model de participació" — diversitat |
| `img/llibre.jpg` | Secció "Comunitat" — Llibre Oficial |
| `img/ampolla.jpg` | Secció "Comunitat" — Ampolla de l'Esperança |
| `img/desembocadura-silueta.jpg` | Possible decoració del seguiment / cta-final |

---

## 2. Imatges noves per generar

**Total: 6 conceptes × 2 versions = 12 fitxers**

### 2.1 — HEROIS I HEROÏNES

#### Concepte 1: Hero de fons
**Fitxers:** `herois-hero.jpg` (desktop) + `herois-hero-mobile.jpg` (mobile)

- **Ús**: fons del hero de `herois.html`. Apareix darrere del títol "Els nostres Herois i Heroïnes" amb un overlay blau opac per sobre (la imatge es veu fosa i amb caràcter, no agressiva).
- **Concepte**: grup divers de persones (no només esportistes joves: famílies, gent gran, adolescents) corrent o caminant per un camí del Llobregat. Esperit comunitari, no competitiu. Llum de matí o capvespre, ambient esperançador.
- **Desktop**: 1920×1080 px, horitzontal panoràmic. Persones distribuïdes per la composició.
- **Mobile**: 800×1100 px, vertical. Centre d'atenció: 1-2 persones en primer pla, la resta difuminades darrere.
- **Prompt suggerit per a ChatGPT**: *"Diverse group of people of different ages running and walking together along a river path in the Catalan countryside at golden hour. Warm soft light, hopeful atmosphere, community spirit. Photorealistic, no logos visible."*

#### Concepte 2: Banner inline de comunitat
**Fitxers:** `herois-comunitat.jpg` + `herois-comunitat-mobile.jpg`

- **Ús**: banner inline entre el llistat d'herois i la secció "El format" (què vol dir ser Heroi o Heroïna).
- **Concepte**: moment d'arribada o sortida. Grup d'herois amb samarretes blaves del repte abraçant-se, donant-se la mà, o aixecant els braços. Emoció autèntica, no pose forçada.
- **Desktop**: 1600×700 px, panoràmic 16:7.
- **Mobile**: 800×1000 px, vertical 4:5.
- **Prompt suggerit**: *"Group of runners and walkers in blue t-shirts celebrating together at the finish line of a community charity run. Hugs, high-fives, smiles. Natural emotion, river background. Photorealistic."*

---

### 2.2 — POBLES

#### Concepte 3: Hero de fons
**Fitxers:** `pobles-hero.jpg` + `pobles-hero-mobile.jpg`

- **Ús**: fons del hero de `pobles.html`. Apareix darrere del títol "Pobles del Llobregat Solidari" amb overlay blau.
- **Concepte**: vista cenital o lateral d'un poble del recorregut amb el riu Llobregat visible. Pot ser un poble petit del Berguedà (Castellar de n'Hug, Berga, La Pobla de Lillet) o una vista del riu travessant teulades. Atmosfera tranquil·la, territori autèntic.
- **Desktop**: 1920×1080 px, panoràmic.
- **Mobile**: 800×1100 px, vertical (composició retallada més tancada).
- **Prompt suggerit**: *"Aerial view of a small Catalan mountain town with the Llobregat river running through it. Stone houses, terracotta roofs, green forest surroundings, Pyrenees foothills in background. Late afternoon light. Photorealistic."*

#### Concepte 4: Banner inline de territori
**Fitxers:** `pobles-territori.jpg` + `pobles-territori-mobile.jpg`

- **Ús**: banner inline entre el llistat de pobles i la secció "El format" (què vol dir adherir el teu poble).
- **Concepte**: acolliment al pas d'un poble. Plaça municipal amb gent local rebent el corredor, banderoles del repte, ambient festiu però acollidor. O alternativament, una vista panoràmica del riu travessant un paisatge de pobles (més abstracte).
- **Desktop**: 1600×700 px, panoràmic 16:7.
- **Mobile**: 800×1000 px, vertical 4:5.
- **Prompt suggerit**: *"Small town square in Catalonia welcoming a charity runner. Locals of all ages clapping, blue solidarity banners, autumn atmosphere. Warm community feeling, authentic. Photorealistic."*

---

### 2.3 — PATROCINA EL REPTE (landing comercial)

#### Concepte 5: Hero de fons
**Fitxers:** `patrocina-hero.jpg` + `patrocina-hero-mobile.jpg`

- **Ús**: fons del hero de `patrocina.html`. Apareix darrere del títol "Posa la teva marca al riu" amb overlay blau intens (la imatge es veu darrere però el text manté contrast màxim).
- **Concepte**: imatge poderosa i evocadora. Silueta d'un corredor solitari amb el riu i les muntanyes en segon pla, èpic i esperançador.
- **Desktop**: 1920×1080 px, panoràmic.
- **Mobile**: 800×1100 px, vertical.
- **Prompt suggerit**: *"Silhouette of a solo trail runner along the Llobregat river at dawn. Mountains in background, river reflecting morning light. Cinematic, powerful, hopeful. Photorealistic, wide shot."*

#### Concepte 6: Banner inline de territori
**Fitxers:** `patrocina-territori.jpg` + `patrocina-territori-mobile.jpg`

- **Ús**: banner inline entre la secció de stats i "Per què patrocinar".
- **Concepte**: el territori del Llobregat representat com a oportunitat de visibilitat. Vista del riu travessant municipis (combinació de paisatge natural i urbà), o una panoràmica àmplia del riu del naixement fins al mar.
- **Desktop**: 1600×700 px, panoràmic 16:7.
- **Mobile**: 800×1000 px, vertical 4:5.
- **Prompt suggerit**: *"Wide aerial view of the Llobregat river winding through Catalan landscape from mountains to sea. Towns visible along the route, mix of nature and civilization. Golden hour, panoramic, photorealistic."*

---

## Resum del que necessites generar

| # | Concepte | Desktop | Mobile |
|---|---|---|---|
| 1 | Herois — hero de fons | `herois-hero.jpg` (1920×1080) | `herois-hero-mobile.jpg` (800×1100) |
| 2 | Herois — comunitat | `herois-comunitat.jpg` (1600×700) | `herois-comunitat-mobile.jpg` (800×1000) |
| 3 | Pobles — hero de fons | `pobles-hero.jpg` (1920×1080) | `pobles-hero-mobile.jpg` (800×1100) |
| 4 | Pobles — territori/acolliment | `pobles-territori.jpg` (1600×700) | `pobles-territori-mobile.jpg` (800×1000) |
| 5 | Patrocina — hero de fons | `patrocina-hero.jpg` (1920×1080) | `patrocina-hero-mobile.jpg` (800×1100) |
| 6 | Patrocina — territori | `patrocina-territori.jpg` (1600×700) | `patrocina-territori-mobile.jpg` (800×1000) |

**Total: 12 fitxers** (6 conceptes × 2 versions cadascun)

---

## Notes pràctiques

- **Sense imatges, la web funciona igual**: tots els `<picture>` tenen `onerror="this.parentElement.style.display='none'"`, així que el contenidor desapareix si la imatge no carrega. El hero queda amb el degradat blau original — exactament com es veu ara.
- **No hi ha cap pressa per pujar-les totes alhora**: pots anar afegint-les una a una a `img/` i veure el resultat. La web detecta automàticament quan apareixen.
- **No fa falta optimitzar abans de pujar**: si una imatge pesa 1-2 MB, encara funcionarà. Si vols optimitzar després, Squoosh.app és gratuït i no et registres a res.
- **Imatges generades per IA**: revisa que no apareguin marques d'aigua, dits estranys o textos il·legibles al fons (Montserrat amb cartells que diuen "Mountain" en anglès, per exemple). Si la IA genera text als cartells, demana-li versió sense text.
- **Versió mobile**: si tens pressa, pots fer servir la mateixa imatge desktop com a mobile inicialment. Quedarà acceptable, encara que no òptim. Després, quan tinguis temps, fes les mobile específiques.
- **Coherència visual**: prova que totes les imatges tinguin un to similar (ex. totes amb llum càlida de matí/capvespre, o totes amb tons freds de muntanya). Si barreges imatges molt diferents, la web semblarà un collage.

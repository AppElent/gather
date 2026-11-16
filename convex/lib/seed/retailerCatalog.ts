import type { BarcodeFormat, FormatConfidence } from '@gather/core/barcodes'
import type { RetailerCategory } from '@gather/core/loyalty-cards'

/**
 * The shipped list of retailers active in the Netherlands that hand out a
 * scannable loyalty card or app pass, present in every environment including
 * production.
 *
 * **This is a picker, not a reference table (ADR-0024).** Choosing an entry
 * copies its name, brand colour, domain and barcode format onto the household's
 * own card; nothing points back here. Retiring or correcting an entry orphans
 * nothing, and a household fixing "its" Kruidvat colour is fixing its own card.
 *
 * `seedKey` is the stable identity across re-seeds and never changes once
 * shipped, even if `name` does.
 *
 * `brandColor` is the brand's primary colour, taken from its own logo (mostly
 * the Wikimedia Commons SVG) or from its site's theme colour or CSS, and
 * checked against the retailer's own site on 2026-11-16 (APP-152). The
 * `Colour:` clause above each entry says where it came from.
 *
 * `formatConfidence: 'sourced'` means a public source shows the symbology, and
 * the `// Source:` line names it: a photo of the card, the retailer's own help
 * text or site code, an app-store screenshot of the retailer's own app (decoded
 * with zxing-cpp where it would decode; a decoded demo payload still shows the
 * symbology the app draws), or a card-app guide. `'guess'` means no public
 * source was found, and the format is then always the CODE_128 fallback; its
 * `// Programme:` line says what was searched and why it did not settle it.
 * `numberLength` and `numberPrefix` appear only when a source states them.
 *
 * Retired in APP-152 (a card that still names one keeps its own copy, ADR-0024):
 * - `trekpleister`: its spaarkaart is a paper stamp card for textile offers,
 *   with nothing to scan (allefolders.nl), so it never belonged in a picker of
 *   scannable cards. No source confirms the stores are converting to Kruidvat
 *   (RetailTrends still treats it as its own chain in April 2026), so it is not
 *   folded into Kruidvat as an alias either.
 * - `blokker`: after the November 2024 bankruptcy the card is no longer scanned
 *   and points cannot be redeemed (BNNVARA, 18 Nov 2024); the restarted chain
 *   has no programme and the app is gone.
 * - `tango`: no card or pass; discounts run through paying in the Tango app
 *   (tango.nl/app/tanken), and the Tango tankpas is a business fuel card.
 */
export interface RetailerCatalogEntry {
  seedKey: string
  name: string
  aliases: string[]
  category: RetailerCategory
  brandColor: string
  domain: string
  barcodeFormat: BarcodeFormat
  formatConfidence: FormatConfidence
  numberLength?: number
  numberPrefix?: string
}

export const RETAILER_CATALOG: RetailerCatalogEntry[] = [
  // --- Supermarkets ---

  // Source: github.com/skaffa/albert-heijn-bonuskaart-generator ("GTIN-13/EAN-13, fixed 26 prefix", ranges 2621…–2623…);
  // Commons "Albert_Heijn_Bonuskaart_old_design_Keychain_cards_(2019)_02.jpg" shows 2620490052648. Colour: Commons logo SVG.
  { seedKey: 'albert-heijn', name: 'Albert Heijn', aliases: ['AH', 'Bonuskaart', 'AH Bonuskaart', 'AH to go', 'AH XL'], category: 'supermarket', brandColor: '#00A0E2', domain: 'ah.nl', barcodeFormat: 'EAN_13', formatConfidence: 'sourced', numberLength: 13, numberPrefix: '262' },
  // Source: Commons "Jumbo_Extra's_passen_(new_design),_Oude_Pekela_(2020)_02.jpg" (EAN-13 guard bars, 2 622273 871224). Colour: jumbo.com logo SVG
  // fill and mask-icon colour.
  { seedKey: 'jumbo', name: 'Jumbo', aliases: ["Jumbo Extra's", 'Extras', 'Jumbo pas'], category: 'supermarket', brandColor: '#EEB717', domain: 'jumbo.com', barcodeFormat: 'EAN_13', formatConfidence: 'sourced', numberLength: 13 },
  // Source: guides.supercardsapp.com/nl/lidl ("scan je QR-code aan de kassa", app only); github.com/CatimaLoyalty/Android/issues/1233. Colour: Commons logo SVG.
  { seedKey: 'lidl', name: 'Lidl', aliases: ['Lidl Plus'], category: 'supermarket', brandColor: '#0050AA', domain: 'lidl.nl', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Source: plus.nl/organisatie/faq-digitale-pluspunten ("Scan jouw QR-code bij de (zelfscan)kassa"). Colour: plus.nl CSS --color-primary-soft and
  // the app icon (the brand is green since the redesign).
  { seedKey: 'plus', name: 'PLUS', aliases: ['PLUSpunten', 'PLUS app', 'Plus supermarkt'], category: 'supermarket', brandColor: '#6EA319', domain: 'plus.nl', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Source: Commons "Hoogvliet_klantenkaarten,_Hillegersberg,_Rotterdam_(2020)_03.jpg" (EAN-13, 2 620336 891721). Colour: hoogvliet.com CSS.
  { seedKey: 'hoogvliet', name: 'Hoogvliet', aliases: ['Hoogvliet klantenkaart', 'Hoogvliet spaarkaart'], category: 'supermarket', brandColor: '#00ACE7', domain: 'hoogvliet.com', barcodeFormat: 'EAN_13', formatConfidence: 'sourced', numberLength: 13 },
  // Programme: vomar.nl (Klant is Koning spaarkaart). Format unknown: app screenshots show only a mock-up barcode that does not decode. CODE_128
  // guess. Colour: Commons Logo_Vomar.svg.
  { seedKey: 'vomar', name: 'Vomar', aliases: ['Vomar Voordeelmarkt', 'Klant is Koning'], category: 'supermarket', brandColor: '#FC0816', domain: 'vomar.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: dekamarkt.nl's own account code draws the card number with JsBarcode, format EAN13 (Nuxt 'barcode-card' component). Colour: Commons
  // Logo_of_Dekamarkt.svg.
  { seedKey: 'dekamarkt', name: 'DekaMarkt', aliases: ['Deka', 'Deka Markt', 'DekaVers'], category: 'supermarket', brandColor: '#E41F13', domain: 'dekamarkt.nl', barcodeFormat: 'EAN_13', formatConfidence: 'sourced', numberLength: 13 },
  // Programme: spar.nl/spar-spaarkaart-9127925 (save digitally in the SPAR app instead of the paper card). Format unknown: no national card found,
  // only local store savings (spar.nl FAQ). CODE_128 guess. Colour: Commons Spar-logo.svg.
  { seedKey: 'spar', name: 'SPAR', aliases: ['SPAR city', 'SPAR app'], category: 'supermarket', brandColor: '#EC1B24', domain: 'spar.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: ekoplaza.nl's own account code draws the Ekovriend card with JsBarcode and no format, which is CODE128. Colour: Commons
  // Logo_of_Ekoplaza.svg.
  { seedKey: 'ekoplaza', name: 'Ekoplaza', aliases: ['Ekoplaza Voordeelpas', 'Eko Plaza'], category: 'supermarket', brandColor: '#702483', domain: 'ekoplaza.nl', barcodeFormat: 'CODE_128', formatConfidence: 'sourced' },
  // Programme: odin.nl/service/meest-gestelde-vragen/ledenpas ("alleen als de winkelmedewerker je ledenpas scant"). Format unknown: the pass is drawn
  // only after login; odin.nl's klantenportaal checks the barcode is exactly 13 characters. CODE_128 guess. Colour: odin.nl CSS (weak).
  { seedKey: 'odin', name: 'Odin', aliases: ['Odin ledenpas', 'Odin biologische supermarkt'], category: 'supermarket', brandColor: '#C5004B', domain: 'odin.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess', numberLength: 13 },

  // --- Liquor stores ---

  // Programme: gall.nl (Mijn Gall & Gall card and app). Format unknown: app screenshots are undecodable mock-ups; gall.nl FAQ: 'het 13 cijferige
  // nummer'. CODE_128 guess. Colour: Commons Gall_logo.svg.
  { seedKey: 'gall-en-gall', name: 'Gall & Gall', aliases: ['Gall', 'Mijn Gall & Gall', 'Gall en Gall'], category: 'liquor', brandColor: '#FF641E', domain: 'gall.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess', numberLength: 13 },
  // Source: App Store 'Mitra Members' (id1543375326) screenshot decodes (zxing-cpp) as Code 128, 2611269913345. Colour: Commons Mitra_Logo.svg and
  // site theme-color.
  { seedKey: 'mitra', name: 'Mitra', aliases: ['Mitra Member', 'Mitra drankenspeciaalzaken'], category: 'liquor', brandColor: '#00A3BD', domain: 'mitra.nl', barcodeFormat: 'CODE_128', formatConfidence: 'sourced', numberLength: 13 },

  // --- Wholesale (business customers, card needed to shop) ---

  // Programme: makro.nl (Makro-pas needed to shop, business customers). Format unknown: the app's 'Digitale pas' mock-up decodes as ITF with
  // placeholder data, too weak to trust. CODE_128 guess. Colour: Commons Makro_Europe_logo.png.
  { seedKey: 'makro', name: 'Makro', aliases: ['Makro-pas', 'Makropas', 'Metro'], category: 'wholesale', brandColor: '#002470', domain: 'makro.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Programme: sligro.nl (Sligro klantenkaart, business customers). Format unknown: no public image of the card. CODE_128 guess. Colour: sligro.nl
  // site icon (dark-green oval logo).
  { seedKey: 'sligro', name: 'Sligro', aliases: ['Sligro klantenkaart', 'Sligro pas'], category: 'wholesale', brandColor: '#034B32', domain: 'sligro.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Programme: hanos.nl (HANOS Wereldpas, business customers). Format unknown: no public image of the Wereldpas. CODE_128 guess. Colour: hanos.nl
  // CSS.
  { seedKey: 'hanos', name: 'HANOS', aliases: ['Wereldpas', 'HANOS Wereldpas'], category: 'wholesale', brandColor: '#57004E', domain: 'hanos.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Drugstores ---

  // Source: Commons "Kruidvat_Jouw_Extra_Voordeelkaart_(2019)_02.jpg" (EAN-13, 2 620964 953211). Colour: Commons Kruidvat_logo.svg.
  { seedKey: 'kruidvat', name: 'Kruidvat', aliases: ['Kruidvat Club', 'Jouw Extra Voordeelkaart', 'Kruidvat pas'], category: 'drugstore', brandColor: '#E2001A', domain: 'kruidvat.nl', barcodeFormat: 'EAN_13', formatConfidence: 'sourced', numberLength: 13 },
  // Source: Commons "Etos_Klantenkaart,_Groningen_(2019)_02.jpg" (EAN-13, 2 621828 088711). Colour: etos.nl TileColor and the current black logo.
  { seedKey: 'etos', name: 'Etos', aliases: ['Mijn Etos', 'Etos klantenkaart'], category: 'drugstore', brandColor: '#000000', domain: 'etos.nl', barcodeFormat: 'EAN_13', formatConfidence: 'sourced', numberLength: 13 },
  // Programme: da.nl/klantenservice/klantenkaart (most DA stores issue their own store-bound card). Format unknown: no current national card found on
  // da.nl (gift card only). CODE_128 guess. Colour: Commons DA logo SVG.
  { seedKey: 'da', name: 'DA', aliases: ['DA Drogist', 'DA Drogisterij', 'Drogisten Associatie'], category: 'drugstore', brandColor: '#E4007A', domain: 'da.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Health stores ---

  // Source: help.hollandandbarrett.nl article 16971125361426 ('jouw voordeelkaart in de vorm van een QR-code'; no new physical cards). Colour: site
  // theme-color.
  { seedKey: 'holland-and-barrett', name: 'Holland & Barrett', aliases: ['H&B', 'Holland en Barrett', 'Voordeelkaart', 'De Tuinen'], category: 'health', brandColor: '#00594C', domain: 'hollandandbarrett.nl', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Programme: vitaminstore.nl/en/vitaminclub and /en/service/terms-vitaminclub (VitaminClub, show membership in store). Format unknown: the
  // VitaminClub page describes no card; in-store scanning is only for vouchers. CODE_128 guess. Colour: vitaminstore.nl logo.svg wordmark.
  { seedKey: 'vitaminstore', name: 'Vitaminstore', aliases: ['VitaminClub', 'Vitamin Store'], category: 'health', brandColor: '#024D5E', domain: 'vitaminstore.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Beauty ---

  // Programme: douglas.nl (Douglas Beauty Card). Format unknown: douglas.nl refuses fetches and no screenshot shows the code. CODE_128 guess.
  // Colour: Commons Douglas_Logo_06.2018.svg.
  { seedKey: 'douglas', name: 'Douglas', aliases: ['Douglas Beauty Card', 'Parfumerie Douglas'], category: 'beauty', brandColor: '#161615', domain: 'douglas.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: App Store 'ICI PARIS XL – Beauty' (id1061895392) Member Card screenshot decodes as Code 128, 2620410189720. Colour: Commons
  // ICI_Paris_XL_logo.svg.
  { seedKey: 'ici-paris-xl', name: 'ICI PARIS XL', aliases: ['ICI Paris', 'ICI TOGETHER'], category: 'beauty', brandColor: '#EC008C', domain: 'iciparisxl.nl', barcodeFormat: 'CODE_128', formatConfidence: 'sourced', numberLength: 13 },
  // Source: rituals.com's own member-card page loads eva.rituals.com/barcode/qr/… ('Member loyalty QR code'). Colour: Commons
  // Rituals_Cosmetics_logo.png.
  { seedKey: 'rituals', name: 'Rituals', aliases: ['My Rituals', 'Rituals Cosmetics'], category: 'beauty', brandColor: '#796F63', domain: 'rituals.com', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Source: kikocosmetics.com/nl-nl KIKO ME help (Wayback, 17 Apr 2026): 'Toon je QR-code in de winkel'; programme relaunched 28 Sep 2026. Colour:
  // KIKO logo black.
  { seedKey: 'kiko-milano', name: 'KIKO Milano', aliases: ['KIKO', 'KIKO ME'], category: 'beauty', brandColor: '#000000', domain: 'kikocosmetics.com', barcodeFormat: 'QR', formatConfidence: 'sourced' },

  // --- DIY ---

  // Source: Google Play 'GAMMA' (nl.gamma.app.android) card tile shows a QR code (decoded, demo payload). Colour: Commons "Gamma logo 2010.png".
  { seedKey: 'gamma', name: 'GAMMA', aliases: ['GAMMA Voordeelpas', 'Voordeelpas'], category: 'diy', brandColor: '#003878', domain: 'gamma.nl', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Source: Google Play 'KARWEI' (nl.karwei.app.android) Club Karwei tile shows a QR code (decoded, demo payload). Colour: Commons "Karwei logo
  // (2017).png".
  { seedKey: 'karwei', name: 'KARWEI', aliases: ['Club Karwei'], category: 'diy', brandColor: '#231F20', domain: 'karwei.nl', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Source: App Store 'Praxis' (id395524977) shows the Praxis Plus pass as a QR code; praxis.nl says there is no physical card any more. Colour:
  // Commons Praxis_logo_2018.svg.
  { seedKey: 'praxis', name: 'Praxis', aliases: ['Praxis Plus', 'Formido'], category: 'diy', brandColor: '#E20019', domain: 'praxis.nl', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Source: App Store 'Hubo Club' (id6747756435) card popup decodes as Code 128 (demo number). Colour: hubo.nl CSS --color-brand-yellow (logo is
  // yellow on navy).
  { seedKey: 'hubo', name: 'Hubo', aliases: ['Hubo Club', 'Hubo klantenkaart'], category: 'diy', brandColor: '#FFD540', domain: 'hubo.nl', barcodeFormat: 'CODE_128', formatConfidence: 'sourced' },
  // Programme: registratie.bouwmaat.nl/heb-je-een-bouwmaat-pasnummer (Bouwmaat pas, digital pass in Mijn Bouwmaat. Format unknown: the Bouwmaat app
  // was withdrawn; no image of the trade pass. CODE_128 guess. Colour: bouwmaat.nl logo markup.
  { seedKey: 'bouwmaat', name: 'Bouwmaat', aliases: ['Bouwmaat pas', 'Bouwmaat spaarplan'], category: 'diy', brandColor: '#000933', domain: 'bouwmaat.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Garden ---

  // Source: App Store 'Intratuin' (id1479674177) shows the Intratuin Extra membercard as a QR code (decoded, demo payload). Colour: intratuin.nl
  // header logo.svg wordmark.
  { seedKey: 'intratuin', name: 'Intratuin', aliases: ['Intratuin membercard', 'Intratuin klantenpas'], category: 'garden', brandColor: '#47A23F', domain: 'intratuin.nl', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Source: welkoop.nl's own 'Mijn klantenpas' code draws the card with react-barcode and no format (CODE128); FAQ: 'het 19-cijferige nummer'.
  // Colour: welkoop.nl klantenpas logo box (theme-color is a framework default).
  { seedKey: 'welkoop', name: 'Welkoop', aliases: ['Welkoop klantenpas', 'Boerenbond'], category: 'garden', brandColor: '#1D4C22', domain: 'welkoop.nl', barcodeFormat: 'CODE_128', formatConfidence: 'sourced', numberLength: 19 },
  // Source: App Store 'Tuinland' (id6478219275) 'Klantenkaart' screenshot decodes as Code 128 (demo number). Colour: tuinland.nl header logo.svg
  // background.
  { seedKey: 'tuinland', name: 'Tuinland', aliases: ['Tuinland klantenpas', 'Tuinland Groep'], category: 'garden', brandColor: '#550E42', domain: 'tuinland.nl', barcodeFormat: 'CODE_128', formatConfidence: 'sourced' },
  // Source: App Store 'GroenRijk' (id1628482188) card barcode decodes as Code 128 (cropped demo; weak). Colour: groenrijk.nl logo.svg wordmark.
  { seedKey: 'groenrijk', name: 'GroenRijk', aliases: ['GroenRijk klantenkaart'], category: 'garden', brandColor: '#005634', domain: 'groenrijk.nl', barcodeFormat: 'CODE_128', formatConfidence: 'sourced' },
  // Programme: opschouwenduiveland.nl Life & Garden listing ("cardholders … collect points for discounts"). Format unknown: the Groeipas runs in two
  // stores only; no image. CODE_128 guess. Colour: lifeandgarden.com logo.png green accent.
  { seedKey: 'life-and-garden', name: 'Life & Garden', aliases: ['Life and Garden', 'Life & Garden klantenkaart'], category: 'garden', brandColor: '#94C356', domain: 'lifeandgarden.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Home ---

  // Source: App Store 'IKEA' NL (id1452164827) shows the IKEA Family pas as a QR code; IKEA BE help says 'IKEA Family QR'. Colour: Commons
  // Ikea_logo.svg.
  { seedKey: 'ikea', name: 'IKEA', aliases: ['IKEA Family'], category: 'home', brandColor: '#0058A3', domain: 'ikea.com', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Source: guides.supercardsapp.com/nl/action ("scan je QR-code bij de kassa", app only, no physical card). Colour: Commons Action_Nederland_Logo_2020.svg.
  { seedKey: 'action', name: 'Action', aliases: ['Mijn Action'], category: 'home', brandColor: '#001489', domain: 'action.com', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Programme: xenos.nl (Xtra Xenos Member). Format unknown: the memberpas arrives by e-mail or wallet; no image shows the code. CODE_128 guess.
  // Colour: Commons Logo-Xenos-Rubin-Red.png.
  { seedKey: 'xenos', name: 'Xenos', aliases: ['Xtra Xenos', 'Xenos Member'], category: 'home', brandColor: '#DE006E', domain: 'xenos.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Programme: flyingtiger.com/nl-nl/blogs/news/flying-tiger-copenhagen-launches-new-app-and-customer-club (Club app). Format unknown: the Club app's
  // linear barcode does not decode, and no Dutch launch of the Club was found. CODE_128 guess. Colour: Commons Flying_Tiger_Copenhagen.svg.
  { seedKey: 'flying-tiger', name: 'Flying Tiger Copenhagen', aliases: ['Flying Tiger', 'Tiger', 'Flying Tiger Club'], category: 'home', brandColor: '#000000', domain: 'flyingtiger.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Programme: jysk.nl/jysk-B2B/klantenkaart (B2B klantenkaart shown in store for a discount. Format unknown: business (B2B) card only; no image.
  // CODE_128 guess. Colour: site theme-color.
  { seedKey: 'jysk', name: 'JYSK', aliases: ['JYSK B2B', 'JYSK klantenkaart'], category: 'home', brandColor: '#243A86', domain: 'jysk.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Fashion, shoes and jewellery ---

  // Programme: C&A for you programme (Commons promo photo shows a barcode, type not identifiable). Format unknown: only a 2022 in-store promo poster
  // (Commons) shows a mock-up card, decoding as UPC-A with a demo number. CODE_128 guess. Colour: Commons C&A_logo.svg.
  { seedKey: 'c-en-a', name: 'C&A', aliases: ['C&A for you', 'CenA', 'C en A'], category: 'fashion', brandColor: '#010202', domain: 'c-and-a.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: App Store 'H&M' (id834465911) membership screen ('present at checkout') shows a QR code; hm.com member page says 'Member QR-code'.
  // Colour: Commons H&M-Logo.svg.
  { seedKey: 'h-en-m', name: 'H&M', aliases: ['H&M Member', 'HM', 'H en M'], category: 'fashion', brandColor: '#CC071E', domain: 'hm.com', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Programme: hunkemoller.nl (Hunkemöller membercard). Format unknown: a 2012 app screenshot (iculture.nl) showed a QR code, but nothing shows
  // today's digital Member card. CODE_128 guess. Colour: hunkemoller.nl CSS.
  { seedKey: 'hunkemoller', name: 'Hunkemöller', aliases: ['Hunkemoller', 'Hunkemöller Member'], category: 'fashion', brandColor: '#6A0437', domain: 'hunkemoller.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Programme: shoeby.nl (Shoeby Style Club). Format unknown: no source shows the card or how it is scanned. CODE_128 guess. Colour: Commons
  // Shoeby-logo.svg.
  { seedKey: 'shoeby', name: 'Shoeby', aliases: ['Shoeby Style Club', 'Style Club'], category: 'fashion', brandColor: '#1D1D1B', domain: 'shoeby.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Programme: only.com (CLUB ONLY). Format unknown: no source shows it; sister brand VERO MODA uses a QR code, but ONLY's app is from another
  // Bestseller company. CODE_128 guess. Colour: ONLY logo black.
  { seedKey: 'only', name: 'ONLY', aliases: ['CLUB ONLY'], category: 'fashion', brandColor: '#000000', domain: 'only.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: support.jackjones.com (en-gb) 'store staff … scan your membership QR code'; same Customer Club and app as in the Netherlands. Colour:
  // jackjones.com/nl-nl header logo (black wordmark).
  { seedKey: 'jack-en-jones', name: 'JACK & JONES', aliases: ['Jack and Jones', 'Jack en Jones'], category: 'fashion', brandColor: '#000000', domain: 'jackjones.com', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Source: support.veromoda.com/hc/nl-be/articles/27906671105937 (staff scan your personal QR code in the VERO MODA app; Belgian help page). Colour: logo black.
  { seedKey: 'vero-moda', name: 'VERO MODA', aliases: ['VERO MODA membership'], category: 'fashion', brandColor: '#000000', domain: 'veromoda.com', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Programme: shop.mango.com/nl/en/terms-and-conditions/mango-style-club (identify before points are added). Format unknown: the terms say 'código
  // de barras' without naming the type; the app shows no member code. CODE_128 guess. Colour: Commons "Logo of Mango (new).svg".
  { seedKey: 'mango', name: 'Mango', aliases: ['Mango Style Club', 'Mango Likes You'], category: 'fashion', brandColor: '#000000', domain: 'mango.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: App Store 'vanHaren Schoenen' (id6746480339) 'PLUS-kaart – Tonen bij de kassa' is a QR code. Colour: site theme-color.
  { seedKey: 'vanharen', name: 'vanHaren', aliases: ['van Haren', 'Van Haren schoenen'], category: 'fashion', brandColor: '#FF5E1F', domain: 'vanharen.nl', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Programme: ziengs.nl (Ziengs loyalty programme). Format unknown: no source shows the card. CODE_128 guess. Colour: ziengs.nl CSS
  // --color-primary.
  { seedKey: 'ziengs', name: 'Ziengs', aliases: ['Ziengs Schoenen'], category: 'fashion', brandColor: '#74F58D', domain: 'ziengs.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: scapino.nl/scapino-extras ("In de winkel laat je jouw QR code in de app scannen bij de kassa"). Colour: scapino.nl CSS.
  { seedKey: 'scapino', name: 'Scapino', aliases: ["Scapino Extra's", 'Scapino Extras'], category: 'fashion', brandColor: '#E3051B', domain: 'scapino.nl', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Programme: nelson.nl/membership and nelson.nl FAQ (link the card with "het nummer onder de barcode"). Format unknown: nelson.nl says only 'het
  // nummer onder de barcode'. CODE_128 guess. Colour: nelson.nl theme-color and black wordmark.
  { seedKey: 'nelson', name: 'Nelson', aliases: ['Nelson Schoenen', 'Nelson Membership', 'Nelson spaarkaart'], category: 'fashion', brandColor: '#000000', domain: 'nelson.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: sacha.nl's own text 'Scan de QR code in de winkel voor het sparen van memberpoints'. Colour: site theme-color.
  { seedKey: 'sacha', name: 'Sacha', aliases: ['Sacha CLUB', 'Sacha schoenen'], category: 'fashion', brandColor: '#000000', domain: 'sacha.nl', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Source: manfield.com's own code draws the member pass as a QR code ('Laat de code scannen aan de kassa'). Colour: site theme-color.
  { seedKey: 'manfield', name: 'Manfield', aliases: ['My Manfield'], category: 'fashion', brandColor: '#000000', domain: 'manfield.com', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Programme: nl.ecco.com/klantendienst/algemene-voorwaarden-voor-het-ecco-lidmaatschapsprogramma (ECCO CLUB, store purchases count). Format unknown:
  // no source shows the card. CODE_128 guess. Colour: Commons Ecco_shoes_logo.svg.
  { seedKey: 'ecco', name: 'ECCO', aliases: ['ECCO CLUB'], category: 'fashion', brandColor: '#000000', domain: 'ecco.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Programme: snipes.com/nl-nl/coins-faq (show your SNIPES ID or Loyalty ID from the app at checkout). Format unknown: the app's 'CLUB ID' button
  // has a QR-style icon, but the code itself never appears. CODE_128 guess. Colour: Commons Snipes_logo.svg.
  { seedKey: 'snipes', name: 'SNIPES', aliases: ['SNIPES CLIQUE', 'SNIPES CLUB'], category: 'fashion', brandColor: '#EC6408', domain: 'snipes.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Programme: klantenservice.livera.nl spaarprogramma article (points in Livera stores only). Format unknown: store-only programme; no card shown.
  // CODE_128 guess. Colour: livera.nl header logo (black wordmark; #861819 was a seasonal banner accent).
  { seedKey: 'livera', name: 'Livera', aliases: ['Livera spaarprogramma'], category: 'fashion', brandColor: '#000000', domain: 'livera.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Programme: lucardi.nl/lucardi-member.html and voorwaarden-klantenkaart.html (digital Member Card). Format unknown: lucardi.nl refuses fetches; no
  // image of the Member Card. CODE_128 guess. Colour: Commons Lucardi_Logo_2023.svg.
  { seedKey: 'lucardi', name: 'Lucardi', aliases: ['Lucardi Member', 'Lucardi Juwelier', 'Lucardi Friends'], category: 'fashion', brandColor: '#510C76', domain: 'lucardi.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: App Store 'Takko Friends' (id1570110927) NL screenshot decodes as QR; it holds a structured string, not just the printed number. Colour:
  // Commons TakkoLogo.svg.
  { seedKey: 'takko', name: 'Takko Fashion', aliases: ['Takko', 'Takko Friends'], category: 'fashion', brandColor: '#A8052C', domain: 'takko.com', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Programme: wefashion.com/nl_NL/we-is-me/we-is-me.html (WE IS ME, sign up at the till in any WE store). Format unknown: WE IS ME identifies by app
  // ID or e-mail address; no code shown. CODE_128 guess. Colour: site theme-color.
  { seedKey: 'we-fashion', name: 'WE Fashion', aliases: ['WE', 'WE IS ME'], category: 'fashion', brandColor: '#000000', domain: 'wefashion.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: App Store 'P&C* Fashion Shop' (id1072106130) NL listing shows the INSIDER-kaart as a QR code. Colour: Commons
  // Logo_Peek_&_Cloppenburg.svg.
  { seedKey: 'peek-cloppenburg', name: 'Peek & Cloppenburg', aliases: ['P&C', 'P&C INSIDER', 'INSIDER', 'Peek en Cloppenburg'], category: 'fashion', brandColor: '#002D65', domain: 'peek-cloppenburg.nl', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Programme: levi.com/NL/en/features/red-tab-members-program (Red Tab Member Card in your mobile wallet for in-store use). Format unknown: not
  // re-researched in APP-152. CODE_128 guess. Colour: Levi's batwing red (not machine-checked, site blocked curl; not re-checked in APP-152).
  { seedKey: 'levis', name: "Levi's", aliases: ['Levis', 'Red Tab', "Levi's Red Tab"], category: 'fashion', brandColor: '#C41230', domain: 'levi.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Programme: hollisterco.com/shop/eu-nl/help/help-faq and EU Club Cali terms (associate scans the Club Cali ID at checkout). Format unknown: Club
  // Cali / House Rewards ID never shown, and Dutch participation is unconfirmed. CODE_128 guess. Colour: Hollister navy (not machine-checked, site
  // blocked curl).
  { seedKey: 'hollister', name: 'Hollister', aliases: ['Hollister Co.', 'Club Cali', 'HCo'], category: 'fashion', brandColor: '#0A2240', domain: 'hollisterco.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Electronics and games ---

  // Source: mediamarkt.nl/en/service/customer-service/mymediamarkt ("myMediaMarkt QR code in Dutch MediaMarkt stores"). Colour: Commons Media_Markt_logo.svg.
  { seedKey: 'mediamarkt', name: 'MediaMarkt', aliases: ['Media Markt', 'myMediaMarkt'], category: 'electronics', brandColor: '#D9222A', domain: 'mediamarkt.nl', barcodeFormat: 'QR', formatConfidence: 'sourced' },

  // --- Books ---

  // Source: Commons 'Primera_spaarpas,_Oude_Pekela_(2019)' photos and App Store 'Primera' (id1387440754) both decode as EAN-13. Colour: primera.nl
  // CSS.
  { seedKey: 'primera', name: 'Primera', aliases: ['PrimeraPas', 'Primera spaarpas'], category: 'books', brandColor: '#FFD500', domain: 'primera.nl', barcodeFormat: 'EAN_13', formatConfidence: 'sourced', numberLength: 13 },
  // Programme: Folderz store page (free The Read Shop klantenkaart). Format unknown: readshop.nl refuses fetches; no image of the card. CODE_128
  // guess. Colour: readshop.nl icon (green 'R' mark, the shipped logo).
  { seedKey: 'the-read-shop', name: 'The Read Shop', aliases: ['Read Shop', 'Readshop'], category: 'books', brandColor: '#00AA13', domain: 'readshop.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Programme: paagman.nl/privilege (Paagman Privilege, digital pass in Apple/Google Wallet, show it at the till). Format unknown: Paagman Privilege
  // (Wayback copies) is scanned at the till and goes in Apple/Google Wallet, but no image shows the code. CODE_128 guess. Colour: paagman.nl icon
  // (magenta 'P' mark, the shipped logo).
  { seedKey: 'paagman', name: 'Paagman', aliases: ['Paagman Privilege', 'Boekhandel Paagman'], category: 'books', brandColor: '#E00076', domain: 'paagman.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Sports ---

  // Programme: decathlon.nl (digital membership card scanned at the till). Format unknown: German and French app screenshots show placeholder linear
  // barcodes that do not decode. CODE_128 guess. Colour: Commons Decathlon 2024 logo SVG.
  { seedKey: 'decathlon', name: 'Decathlon', aliases: ['Decathlon member', 'Decathlon klantenkaart'], category: 'sports', brandColor: '#3642B8', domain: 'decathlon.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Programme: intersport.nl (CLUB member, 2.5% saving). Format unknown: no source shows the CLUB card. CODE_128 guess. Colour: Commons
  // Intersport_logo.svg.
  { seedKey: 'intersport', name: 'INTERSPORT', aliases: ['Intersport CLUB'], category: 'sports', brandColor: '#11448F', domain: 'intersport.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Programme: bever.nl/buitenvriend.html (Bever Card as one way to be a Buitenlid). Format unknown: no source shows the Buitenvriend card. CODE_128
  // guess. Colour: Commons "Bever Logo.png".
  { seedKey: 'bever', name: 'Bever', aliases: ['Bever Card', 'Buitenvriend', 'Buitenlid'], category: 'sports', brandColor: '#2C4D4B', domain: 'bever.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Programme: jdsports.nl/customer-service/privacy (purchases "waarbij je de JD Status App in de winkel gebruikt"). Format unknown: no Dutch JD
  // STATUS launch found; the app is UK-based. CODE_128 guess. Colour: JD logo black.
  { seedKey: 'jd-sports', name: 'JD Sports', aliases: ['JD'], category: 'sports', brandColor: '#000000', domain: 'jdsports.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: Google Play 'adidas' NL listing shows the adiClub pass as a QR code that decodes to the printed member ID. Colour: logo black.
  { seedKey: 'adidas', name: 'adidas', aliases: ['adiClub'], category: 'sports', brandColor: '#000000', domain: 'adidas.nl', barcodeFormat: 'QR', formatConfidence: 'sourced' },

  // --- Toys ---

  // Source: Google Play 'LEGO Insiders' (com.lego.membership) card: bar widths measured by hand match Code 128 (Start C); zxing could not decode.
  // Colour: Commons LEGO_logo.svg.
  { seedKey: 'lego', name: 'LEGO', aliases: ['LEGO Insiders', 'LEGO VIP', 'LEGO Store'], category: 'toys', brandColor: '#E3000B', domain: 'lego.com', barcodeFormat: 'CODE_128', formatConfidence: 'sourced' },
  // Programme: dreamland.nl/nieuw-merkidentiteit-nieuw-hoofdstuk (former ToyChamp stores. Format unknown: no image of the card; dreamland.nl refuses
  // fetches. CODE_128 guess. Colour: dreamland.nl CSS (weak).
  { seedKey: 'dreamland', name: 'DreamLand', aliases: ['ToyChamp', 'DreamLand Plus'], category: 'toys', brandColor: '#F02D2D', domain: 'dreamland.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Pets ---

  // Programme: maxizoo.nl/klantenkaart (digital klantenkaart. Format unknown: the app mock-up decodes as Codabar but does not match its printed
  // number, too weak to trust. CODE_128 guess. Colour: maxizoo.nl logo markup.
  { seedKey: 'maxi-zoo', name: 'Maxi Zoo', aliases: ['Jumper', 'Maxi Zoo Friends', 'MaxiZoo'], category: 'pets', brandColor: '#196427', domain: 'maxizoo.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Programme: discus.nl/dierenwinkel/nieuwkoop-amsterdam-z-o-1 (free klantenkaart, points towards a €10 voucher). Format unknown: no image of the
  // card. CODE_128 guess. Colour: discus.nl header logo (the green badge; the site CSS green #257333 is darker).
  { seedKey: 'discus', name: 'Discus', aliases: ['Discus dierenwinkel', 'Discus klantenkaart'], category: 'pets', brandColor: '#00A13A', domain: 'discus.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Programme: petsplace.nl/acties/hondendag (mentions the Pets Place "Premium klantenkaart"). Format unknown: no image of the Premium klantenkaart.
  // CODE_128 guess. Colour: Commons "Pets Place logo 01.png".
  { seedKey: 'pets-place', name: 'Pets Place', aliases: ['Petsplace', 'Pets Place Premium'], category: 'pets', brandColor: '#DC001B', domain: 'petsplace.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Department stores ---

  // Source: HEMA's own App Store text (id660294353): 'Scan de QR code in de app bij elke aankoop om punten te sparen'. Colour: Commons HEMA_Logo.svg.
  { seedKey: 'hema', name: 'HEMA', aliases: ['HEMA pas', 'meer HEMA'], category: 'department', brandColor: '#E3191C', domain: 'hema.nl', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Source: App Store 'de Bijenkorf' (id545576700) membership screen has a 'Bekijk QR-code' button; also an Apple Wallet card. Colour: logo black.
  { seedKey: 'bijenkorf', name: 'de Bijenkorf', aliases: ['Bijenkorf', 'Bijenkorf Membership'], category: 'department', brandColor: '#000000', domain: 'debijenkorf.nl', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Source: rataplan.nl klantenpas runs on Piggy (scanned on the tablet at the till); Piggy's terms: 'physical card with a unique QR code or the
  // Piggy app'. Colour: rataplan.nl logo markup.
  { seedKey: 'rataplan', name: 'RataPlan', aliases: ['RataPlan klantenpas', 'RataPlan kringloop'], category: 'department', brandColor: '#3EA536', domain: 'rataplan.nl', barcodeFormat: 'QR', formatConfidence: 'sourced' },

  // --- Fuel ---

  // Programme: shell.nl (Shell App / Shell GO+. Format unknown: the app says 'Scan je digitale Shell GO+ kaart', but nothing Dutch shows the code.
  // CODE_128 guess. Colour: Commons Shell_wordmark_2019.svg.
  { seedKey: 'shell', name: 'Shell', aliases: ['Shell GO+', 'Shell App', 'Shell GO plus'], category: 'fuel', brandColor: '#DD1D21', domain: 'shell.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: App Store 'Esso: Spaarprogramma' (id1394581961) 'Jouw kaart nu ook digitaal' shows the Extras card as a QR code. Colour: Commons
  // Esso_textlogo.svg.
  { seedKey: 'esso', name: 'Esso', aliases: ['Esso Extras', 'Esso spaarprogramma'], category: 'fuel', brandColor: '#DA0013', domain: 'esso.nl', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Programme: circlek.nl/reward-club (Reward Club, formerly Club TotalEnergies, "digitale pas"). Format unknown: the Reward Club card is digital
  // only; shop.reward-club.nl/card-checker fixes 13 digits starting 9902. CODE_128 guess. Colour: Circle K red (not machine-checked, site page
  // empty).
  { seedKey: 'circle-k', name: 'Circle K', aliases: ['Circle K Reward Club', 'Club TotalEnergies', 'TotalEnergies', 'Total'], category: 'fuel', brandColor: '#EE2722', domain: 'circlek.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess', numberLength: 13, numberPrefix: '9902' },
  // Source: freebees.nl (bp and OK's FreeBees) digital-card image decodes as Code 128 (demo); the plastic-card form takes 14 digits. Colour: Commons
  // Bp_textlogo.svg.
  { seedKey: 'bp', name: 'bp', aliases: ['FreeBees', 'BPme'], category: 'fuel', brandColor: '#109A2E', domain: 'bp.com', barcodeFormat: 'CODE_128', formatConfidence: 'sourced', numberLength: 14 },
  // Programme: App Store "ViaAVIA" (saving with the app at staffed AVIA stations, plastic card at unstaffed ones). Format unknown: card and app
  // images show no code. CODE_128 guess. Colour: Commons AVIA_International_logo.svg.
  { seedKey: 'avia', name: 'AVIA', aliases: ['ViaAVIA'], category: 'fuel', brandColor: '#ED1C24', domain: 'avia.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Mobility ---

  // Programme: kwik-fit.nl/anwb ("met je ANWB lidmaatschapspas profiteer je …"). Format unknown: the app has a 'Toon barcode' button, but the code is
  // never shown. CODE_128 guess. Colour: ANWB yellow, anwb.nl CSS.
  { seedKey: 'anwb', name: 'ANWB', aliases: ['ANWB lidmaatschapspas', 'ANWB Ledenvoordeel', 'Wegenwacht'], category: 'mobility', brandColor: '#FFCD00', domain: 'anwb.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Programme: App Store "Loogman - WasApp" (points for every wash at Loogman Carwash. Format unknown: no member card or pass: WasApp rewards are QR
  // vouchers. CODE_128 guess. Colour: loogman.nl CSS.
  { seedKey: 'loogman', name: 'Loogman', aliases: ['Loogman Carwash', 'Loogman WasApp', 'Loogman tanken & wassen'], category: 'mobility', brandColor: '#003880', domain: 'loogman.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
]

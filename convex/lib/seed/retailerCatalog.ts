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
 * the Wikimedia Commons SVG) or from its site's theme colour or CSS. The
 * `// Source:` line above each entry says which.
 *
 * `formatConfidence: 'sourced'` means a public source shows the symbology: a
 * photo of the card, the retailer's own help text, or a card-app guide.
 * `'guess'` means no public source was found, and the format is then always the
 * CODE_128 fallback. `numberLength` and `numberPrefix` appear only when a
 * source states them.
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
  // --- Supermarkets (and liquor stores) ---

  // Source: github.com/skaffa/albert-heijn-bonuskaart-generator ("GTIN-13/EAN-13, fixed 26 prefix", ranges 2621…–2623…);
  // Commons "Albert_Heijn_Bonuskaart_old_design_Keychain_cards_(2019)_02.jpg" shows 2620490052648. Colour: Commons logo SVG.
  { seedKey: 'albert-heijn', name: 'Albert Heijn', aliases: ['AH', 'Bonuskaart', 'AH Bonuskaart', 'AH to go', 'AH XL'], category: 'supermarket', brandColor: '#00A0E2', domain: 'ah.nl', barcodeFormat: 'EAN_13', formatConfidence: 'sourced', numberLength: 13, numberPrefix: '262' },
  // Source: Commons "Jumbo_Extra's_passen_(new_design),_Oude_Pekela_(2020)_02.jpg" (EAN-13 guard bars, 2 622273 871224). Colour: Commons logo SVG.
  { seedKey: 'jumbo', name: 'Jumbo', aliases: ["Jumbo Extra's", 'Extras', 'Jumbo pas'], category: 'supermarket', brandColor: '#FFCC00', domain: 'jumbo.com', barcodeFormat: 'EAN_13', formatConfidence: 'sourced', numberLength: 13 },
  // Source: guides.supercardsapp.com/nl/lidl ("scan je QR-code aan de kassa", app only); github.com/CatimaLoyalty/Android/issues/1233. Colour: Commons logo SVG.
  { seedKey: 'lidl', name: 'Lidl', aliases: ['Lidl Plus'], category: 'supermarket', brandColor: '#0050AA', domain: 'lidl.nl', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Source: plus.nl/organisatie/faq-digitale-pluspunten ("Scan jouw QR-code bij de (zelfscan)kassa"). Colour: Commons PLUS_supermarket_logo.svg.
  { seedKey: 'plus', name: 'PLUS', aliases: ['PLUSpunten', 'PLUS app', 'Plus supermarkt'], category: 'supermarket', brandColor: '#E3131D', domain: 'plus.nl', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Source: Commons "Hoogvliet_klantenkaarten,_Hillegersberg,_Rotterdam_(2020)_03.jpg" (EAN-13, 2 620336 891721). Colour: hoogvliet.com CSS.
  { seedKey: 'hoogvliet', name: 'Hoogvliet', aliases: ['Hoogvliet klantenkaart', 'Hoogvliet spaarkaart'], category: 'supermarket', brandColor: '#00ACE7', domain: 'hoogvliet.com', barcodeFormat: 'EAN_13', formatConfidence: 'sourced', numberLength: 13 },
  // Source: vomar.nl (Klant is Koning spaarkaart); format unknown, no public source; CODE_128 guess. Colour: Commons Logo_Vomar.svg.
  { seedKey: 'vomar', name: 'Vomar', aliases: ['Vomar Voordeelmarkt', 'Klant is Koning'], category: 'supermarket', brandColor: '#FC0816', domain: 'vomar.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: dekamarkt.nl (points balance in the DekaMarkt app); format unknown, no public source; CODE_128 guess. Colour: Commons Logo_of_Dekamarkt.svg.
  { seedKey: 'dekamarkt', name: 'DekaMarkt', aliases: ['Deka', 'Deka Markt', 'DekaVers'], category: 'supermarket', brandColor: '#E41F13', domain: 'dekamarkt.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: spar.nl/spar-spaarkaart-9127925 (save digitally in the SPAR app instead of the paper card); format unknown; CODE_128 guess. Colour: Commons Spar-logo.svg.
  { seedKey: 'spar', name: 'SPAR', aliases: ['SPAR city', 'SPAR app'], category: 'supermarket', brandColor: '#EC1B24', domain: 'spar.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: ekoplaza.nl/nl/profielen/voordeelpas (Ekoplaza Voordeelpas); format unknown, no public source; CODE_128 guess. Colour: Commons Logo_of_Ekoplaza.svg.
  { seedKey: 'ekoplaza', name: 'Ekoplaza', aliases: ['Ekoplaza Voordeelpas', 'Eko Plaza'], category: 'supermarket', brandColor: '#702483', domain: 'ekoplaza.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: odin.nl/service/meest-gestelde-vragen/ledenpas ("alleen als de winkelmedewerker je ledenpas scant"); format unknown; CODE_128 guess. Colour: odin.nl CSS (weak).
  { seedKey: 'odin', name: 'Odin', aliases: ['Odin ledenpas', 'Odin biologische supermarkt'], category: 'supermarket', brandColor: '#C5004B', domain: 'odin.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: gall.nl (Mijn Gall & Gall card and app); format unknown, no public source; CODE_128 guess. Colour: Commons Gall_logo.svg.
  { seedKey: 'gall-en-gall', name: 'Gall & Gall', aliases: ['Gall', 'Mijn Gall & Gall', 'Gall en Gall'], category: 'supermarket', brandColor: '#FF641E', domain: 'gall.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: mitra.nl (Mitra Member app); format unknown, no public source; CODE_128 guess. Colour: Commons Mitra_Logo.svg and site theme-color.
  { seedKey: 'mitra', name: 'Mitra', aliases: ['Mitra Member', 'Mitra drankenspeciaalzaken'], category: 'supermarket', brandColor: '#00A3BD', domain: 'mitra.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: makro.nl (Makro-pas needed to shop, business customers); format unknown; CODE_128 guess. Colour: Commons Makro_Europe_logo.png.
  { seedKey: 'makro', name: 'Makro', aliases: ['Makro-pas', 'Makropas', 'Metro'], category: 'supermarket', brandColor: '#002470', domain: 'makro.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: sligro.nl (Sligro klantenkaart, business customers); format unknown; CODE_128 guess. Colour: Sligro logo red (not machine-checked, site gave no colours).
  { seedKey: 'sligro', name: 'Sligro', aliases: ['Sligro klantenkaart', 'Sligro pas'], category: 'supermarket', brandColor: '#E30613', domain: 'sligro.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: hanos.nl (HANOS Wereldpas, business customers); format unknown; CODE_128 guess. Colour: hanos.nl CSS.
  { seedKey: 'hanos', name: 'HANOS', aliases: ['Wereldpas', 'HANOS Wereldpas'], category: 'supermarket', brandColor: '#57004E', domain: 'hanos.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Drugstores ---

  // Source: Commons "Kruidvat_Jouw_Extra_Voordeelkaart_(2019)_02.jpg" (EAN-13, 2 620964 953211). Colour: Commons Kruidvat_logo.svg.
  { seedKey: 'kruidvat', name: 'Kruidvat', aliases: ['Kruidvat Club', 'Jouw Extra Voordeelkaart', 'Kruidvat pas'], category: 'drugstore', brandColor: '#E2001A', domain: 'kruidvat.nl', barcodeFormat: 'EAN_13', formatConfidence: 'sourced', numberLength: 13 },
  // Source: Commons "Etos_Klantenkaart,_Groningen_(2019)_02.jpg" (EAN-13, 2 621828 088711). Colour: etos.nl CSS (logo itself is black).
  { seedKey: 'etos', name: 'Etos', aliases: ['Mijn Etos', 'Etos klantenkaart'], category: 'drugstore', brandColor: '#006AE7', domain: 'etos.nl', barcodeFormat: 'EAN_13', formatConfidence: 'sourced', numberLength: 13 },
  // Source: trekpleister.nl (spaarkaart; A.S. Watson, like Kruidvat); format unknown, no public source; CODE_128 guess. Colour: Commons Trekpleister.svg.
  { seedKey: 'trekpleister', name: 'Trekpleister', aliases: ['Trekpleister spaarkaart'], category: 'drugstore', brandColor: '#EE7203', domain: 'trekpleister.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: da.nl/klantenservice/klantenkaart (most DA stores issue their own store-bound card); format unknown; CODE_128 guess. Colour: Commons DA logo SVG.
  { seedKey: 'da', name: 'DA', aliases: ['DA Drogist', 'DA Drogisterij', 'Drogisten Associatie'], category: 'drugstore', brandColor: '#E4007A', domain: 'da.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Pharmacy and health ---

  // Source: hollandandbarrett.nl (Voordeelkaart); format unknown, no public source; CODE_128 guess. Colour: site theme-color.
  { seedKey: 'holland-and-barrett', name: 'Holland & Barrett', aliases: ['H&B', 'Holland en Barrett', 'Voordeelkaart', 'De Tuinen'], category: 'pharmacy', brandColor: '#00594C', domain: 'hollandandbarrett.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: vitaminstore.nl/en/vitaminclub and /en/service/terms-vitaminclub (VitaminClub, show membership in store); format unknown; CODE_128 guess. Colour: Commons Vitaminstore_Logo.svg.
  { seedKey: 'vitaminstore', name: 'Vitaminstore', aliases: ['VitaminClub', 'Vitamin Store'], category: 'pharmacy', brandColor: '#2A4B5A', domain: 'vitaminstore.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Beauty ---

  // Source: douglas.nl (Douglas Beauty Card); format unknown, no public source; CODE_128 guess. Colour: Commons Douglas_Logo_06.2018.svg.
  { seedKey: 'douglas', name: 'Douglas', aliases: ['Douglas Beauty Card', 'Parfumerie Douglas'], category: 'beauty', brandColor: '#161615', domain: 'douglas.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: iciparisxl.nl (ICI TOGETHER loyalty programme); format unknown, no public source; CODE_128 guess. Colour: Commons ICI_Paris_XL_logo.svg.
  { seedKey: 'ici-paris-xl', name: 'ICI PARIS XL', aliases: ['ICI Paris', 'ICI TOGETHER'], category: 'beauty', brandColor: '#EC008C', domain: 'iciparisxl.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: rituals.com (My Rituals membership); format unknown, no public source; CODE_128 guess. Colour: Commons Rituals_Cosmetics_logo.png.
  { seedKey: 'rituals', name: 'Rituals', aliases: ['My Rituals', 'Rituals Cosmetics'], category: 'beauty', brandColor: '#796F63', domain: 'rituals.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: kikocosmetics.com/nl-nl (KIKO ME loyalty programme); format unknown, no public source; CODE_128 guess. Colour: KIKO logo black.
  { seedKey: 'kiko-milano', name: 'KIKO Milano', aliases: ['KIKO', 'KIKO ME'], category: 'beauty', brandColor: '#000000', domain: 'kikocosmetics.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- DIY ---

  // Source: gamma.nl/voordeelpas/veelgestelde-vragen (GAMMA Voordeelpas; the 3910… code on receipts is not the card number);
  // format unknown; CODE_128 guess. Colour: Commons "Gamma logo 2010.png".
  { seedKey: 'gamma', name: 'GAMMA', aliases: ['GAMMA Voordeelpas', 'Voordeelpas'], category: 'diy', brandColor: '#003878', domain: 'gamma.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: karwei.nl (Club KARWEI); format unknown, no public source; CODE_128 guess. Colour: Commons "Karwei logo (2017).png".
  { seedKey: 'karwei', name: 'KARWEI', aliases: ['Club Karwei'], category: 'diy', brandColor: '#231F20', domain: 'karwei.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: praxis.nl (Praxis Plus app, also valid at Formido); format unknown, no public source; CODE_128 guess. Colour: Commons Praxis_logo_2018.svg.
  { seedKey: 'praxis', name: 'Praxis', aliases: ['Praxis Plus', 'Formido'], category: 'diy', brandColor: '#E20019', domain: 'praxis.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: hubo.nl (Hubo Club app, "klantenkaartnummer … onder de barcode", physical card too); format unknown; CODE_128 guess.
  // Colour: Hubo logo orange (not machine-checked).
  { seedKey: 'hubo', name: 'Hubo', aliases: ['Hubo Club', 'Hubo klantenkaart'], category: 'diy', brandColor: '#F18A00', domain: 'hubo.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: registratie.bouwmaat.nl/heb-je-een-bouwmaat-pasnummer (Bouwmaat pas, digital pass in Mijn Bouwmaat; trade customers); format unknown;
  // CODE_128 guess. Colour: bouwmaat.nl logo markup.
  { seedKey: 'bouwmaat', name: 'Bouwmaat', aliases: ['Bouwmaat pas', 'Bouwmaat spaarplan'], category: 'diy', brandColor: '#000933', domain: 'bouwmaat.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Garden ---

  // Source: intratuin.nl (Intratuin membercard); format unknown, no public source; CODE_128 guess. Colour: intratuin.nl CSS.
  { seedKey: 'intratuin', name: 'Intratuin', aliases: ['Intratuin membercard', 'Intratuin klantenpas'], category: 'garden', brandColor: '#FF8322', domain: 'intratuin.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: guides.supercardsapp.com/nl/welkoop ("de 19 cijfers van je klantenpas"); symbology not stated; CODE_128 guess. Colour: site theme-color.
  { seedKey: 'welkoop', name: 'Welkoop', aliases: ['Welkoop klantenpas', 'Boerenbond'], category: 'garden', brandColor: '#0176D3', domain: 'welkoop.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess', numberLength: 19 },
  // Source: tuinland.nl (klantenpas and app, "pasnummer onderaan de streepjescode"); format unknown; CODE_128 guess. Colour: tuinland.nl CSS (weak).
  { seedKey: 'tuinland', name: 'Tuinland', aliases: ['Tuinland klantenpas', 'Tuinland Groep'], category: 'garden', brandColor: '#27AE61', domain: 'tuinland.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: groenrijk.nl (GroenRijk klantenkaart and app); format unknown, no public source; CODE_128 guess. Colour: groenrijk.nl CSS (weak).
  { seedKey: 'groenrijk', name: 'GroenRijk', aliases: ['GroenRijk klantenkaart'], category: 'garden', brandColor: '#42B6C9', domain: 'groenrijk.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: opschouwenduiveland.nl Life & Garden listing ("cardholders … collect points for discounts"); format unknown; CODE_128 guess.
  // Colour: Life & Garden logo green (not machine-checked).
  { seedKey: 'life-and-garden', name: 'Life & Garden', aliases: ['Life and Garden', 'Life & Garden klantenkaart'], category: 'garden', brandColor: '#5A8C2B', domain: 'lifeandgarden.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Home ---

  // Source: ikea.com/nl (IKEA Family card and app); format unknown, no public source; CODE_128 guess. Colour: Commons Ikea_logo.svg.
  { seedKey: 'ikea', name: 'IKEA', aliases: ['IKEA Family'], category: 'home', brandColor: '#0058A3', domain: 'ikea.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: guides.supercardsapp.com/nl/action ("scan je QR-code bij de kassa", app only, no physical card). Colour: Commons Action_Nederland_Logo_2020.svg.
  { seedKey: 'action', name: 'Action', aliases: ['Mijn Action'], category: 'home', brandColor: '#001489', domain: 'action.com', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Source: xenos.nl (Xtra Xenos Member); format unknown, no public source; CODE_128 guess. Colour: Commons Logo-Xenos-Rubin-Red.png.
  { seedKey: 'xenos', name: 'Xenos', aliases: ['Xtra Xenos', 'Xenos Member'], category: 'home', brandColor: '#DE006E', domain: 'xenos.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: flyingtiger.com/nl-nl/blogs/news/flying-tiger-copenhagen-launches-new-app-and-customer-club (Club app); format unknown;
  // CODE_128 guess. Colour: Commons Flying_Tiger_Copenhagen.svg.
  { seedKey: 'flying-tiger', name: 'Flying Tiger Copenhagen', aliases: ['Flying Tiger', 'Tiger', 'Flying Tiger Club'], category: 'home', brandColor: '#000000', domain: 'flyingtiger.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: blokker.nl app FAQ ("knop 'klantkaart' … kan gescand worden aan de kassa", Blokker&jij); format unknown; CODE_128 guess.
  // Colour: Commons Blokker-Logo.svg (current wordmark, black).
  { seedKey: 'blokker', name: 'Blokker', aliases: ['Blokker&jij', 'Blokker en jij'], category: 'home', brandColor: '#000000', domain: 'blokker.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: jysk.nl/jysk-B2B/klantenkaart (B2B klantenkaart shown in store for a discount; business customers only); format unknown;
  // CODE_128 guess. Colour: site theme-color.
  { seedKey: 'jysk', name: 'JYSK', aliases: ['JYSK B2B', 'JYSK klantenkaart'], category: 'home', brandColor: '#243A86', domain: 'jysk.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Fashion, shoes and jewellery ---

  // Source: C&A for you programme (Commons promo photo shows a barcode, type not identifiable); CODE_128 guess. Colour: Commons C&A_logo.svg.
  { seedKey: 'c-en-a', name: 'C&A', aliases: ['C&A for you', 'CenA', 'C en A'], category: 'fashion', brandColor: '#010202', domain: 'c-and-a.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: hm.com (H&M Member ID in the app); consultancy.nl Sia Loyalty Benchmark 2026 lists H&M; format unknown; CODE_128 guess. Colour: Commons H&M-Logo.svg.
  { seedKey: 'h-en-m', name: 'H&M', aliases: ['H&M Member', 'HM', 'H en M'], category: 'fashion', brandColor: '#CC071E', domain: 'hm.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: hunkemoller.nl (Hunkemöller membercard); format unknown, no public source; CODE_128 guess. Colour: hunkemoller.nl CSS.
  { seedKey: 'hunkemoller', name: 'Hunkemöller', aliases: ['Hunkemoller', 'Hunkemöller Member'], category: 'fashion', brandColor: '#6A0437', domain: 'hunkemoller.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: shoeby.nl (Shoeby Style Club); format unknown, no public source; CODE_128 guess. Colour: Commons Shoeby-logo.svg.
  { seedKey: 'shoeby', name: 'Shoeby', aliases: ['Shoeby Style Club', 'Style Club'], category: 'fashion', brandColor: '#1D1D1B', domain: 'shoeby.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: only.com (CLUB ONLY); format unknown, no public source; CODE_128 guess. Colour: ONLY logo black.
  { seedKey: 'only', name: 'ONLY', aliases: ['CLUB ONLY'], category: 'fashion', brandColor: '#000000', domain: 'only.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: support.jackjones.com (nl-nl, JACK & JONES Customer Club); format unknown; CODE_128 guess. Colour: Commons Jack_&_Jones_logo.svg.
  { seedKey: 'jack-en-jones', name: 'JACK & JONES', aliases: ['Jack and Jones', 'Jack en Jones'], category: 'fashion', brandColor: '#00268A', domain: 'jackjones.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: support.veromoda.com/hc/nl-be/articles/27906671105937 (staff scan your personal QR code in the VERO MODA app; Belgian help page). Colour: logo black.
  { seedKey: 'vero-moda', name: 'VERO MODA', aliases: ['VERO MODA membership'], category: 'fashion', brandColor: '#000000', domain: 'veromoda.com', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Source: shop.mango.com/nl/en/terms-and-conditions/mango-style-club (identify before points are added); format unknown; CODE_128 guess.
  // Colour: Commons "Logo of Mango (new).svg".
  { seedKey: 'mango', name: 'Mango', aliases: ['Mango Style Club', 'Mango Likes You'], category: 'fashion', brandColor: '#000000', domain: 'mango.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: RetailDetail, Dec 2025 (vanHaren loyalty programme in its app); format unknown; CODE_128 guess. Colour: site theme-color.
  { seedKey: 'vanharen', name: 'vanHaren', aliases: ['van Haren', 'Van Haren schoenen'], category: 'fashion', brandColor: '#FF5E1F', domain: 'vanharen.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: ziengs.nl (Ziengs loyalty programme); format unknown, no public source; CODE_128 guess. Colour: ziengs.nl CSS (weak).
  { seedKey: 'ziengs', name: 'Ziengs', aliases: ['Ziengs Schoenen'], category: 'fashion', brandColor: '#713D24', domain: 'ziengs.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: scapino.nl/scapino-extras ("In de winkel laat je jouw QR code in de app scannen bij de kassa"). Colour: scapino.nl CSS.
  { seedKey: 'scapino', name: 'Scapino', aliases: ["Scapino Extra's", 'Scapino Extras'], category: 'fashion', brandColor: '#E3051B', domain: 'scapino.nl', barcodeFormat: 'QR', formatConfidence: 'sourced' },
  // Source: nelson.nl/membership and nelson.nl FAQ (link the card with "het nummer onder de barcode"); symbology not stated; CODE_128 guess. Colour: nelson.nl CSS.
  { seedKey: 'nelson', name: 'Nelson', aliases: ['Nelson Schoenen', 'Nelson Membership', 'Nelson spaarkaart'], category: 'fashion', brandColor: '#CE181E', domain: 'nelson.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: sacha.nl/sacha-club-voorwaarden (Sacha CLUB, points in store and online); format unknown; CODE_128 guess. Colour: site theme-color.
  { seedKey: 'sacha', name: 'Sacha', aliases: ['Sacha CLUB', 'Sacha schoenen'], category: 'fashion', brandColor: '#000000', domain: 'sacha.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: manfield.com/my-manfield-voorwaarden (My Manfield, points in store and online); format unknown; CODE_128 guess. Colour: site theme-color.
  { seedKey: 'manfield', name: 'Manfield', aliases: ['My Manfield'], category: 'fashion', brandColor: '#000000', domain: 'manfield.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: nl.ecco.com/klantendienst/algemene-voorwaarden-voor-het-ecco-lidmaatschapsprogramma (ECCO CLUB, store purchases count);
  // format unknown; CODE_128 guess. Colour: Commons Ecco_shoes_logo.svg.
  { seedKey: 'ecco', name: 'ECCO', aliases: ['ECCO CLUB'], category: 'fashion', brandColor: '#000000', domain: 'ecco.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: snipes.com/nl-nl/coins-faq (show your SNIPES ID or Loyalty ID from the app at checkout); format unknown; CODE_128 guess. Colour: Commons Snipes_logo.svg.
  { seedKey: 'snipes', name: 'SNIPES', aliases: ['SNIPES CLIQUE', 'SNIPES CLUB'], category: 'fashion', brandColor: '#EC6408', domain: 'snipes.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: klantenservice.livera.nl spaarprogramma article (points in Livera stores only); format unknown; CODE_128 guess. Colour: livera.nl logo markup.
  { seedKey: 'livera', name: 'Livera', aliases: ['Livera spaarprogramma'], category: 'fashion', brandColor: '#861819', domain: 'livera.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: lucardi.nl/lucardi-member.html and voorwaarden-klantenkaart.html (digital Member Card); format unknown; CODE_128 guess. Colour: Commons Lucardi_Logo_2023.svg.
  { seedKey: 'lucardi', name: 'Lucardi', aliases: ['Lucardi Member', 'Lucardi Juwelier', 'Lucardi Friends'], category: 'fashion', brandColor: '#510C76', domain: 'lucardi.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: takko.com/nl-nl/takkofriends.html (Takko Friends, valid in Dutch stores); format unknown; CODE_128 guess. Colour: Commons TakkoLogo.svg.
  { seedKey: 'takko', name: 'Takko Fashion', aliases: ['Takko', 'Takko Friends'], category: 'fashion', brandColor: '#A8052C', domain: 'takko.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: wefashion.com/nl_NL/we-is-me/we-is-me.html (WE IS ME, sign up at the till in any WE store); format unknown; CODE_128 guess. Colour: site theme-color.
  { seedKey: 'we-fashion', name: 'WE Fashion', aliases: ['WE', 'WE IS ME'], category: 'fashion', brandColor: '#000000', domain: 'wefashion.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: peek-cloppenburg.nl/nl/insider (INSIDER klantenkaart, digital card in the P&C app, stores only); format unknown; CODE_128 guess.
  // Colour: Commons Logo_Peek_&_Cloppenburg.svg.
  { seedKey: 'peek-cloppenburg', name: 'Peek & Cloppenburg', aliases: ['P&C', 'P&C INSIDER', 'INSIDER', 'Peek en Cloppenburg'], category: 'fashion', brandColor: '#002D65', domain: 'peek-cloppenburg.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: levi.com/NL/en/features/red-tab-members-program (Red Tab Member Card in your mobile wallet for in-store use); format unknown;
  // CODE_128 guess. Colour: Levi's batwing red (not machine-checked, site blocked curl).
  { seedKey: 'levis', name: "Levi's", aliases: ['Levis', 'Red Tab', "Levi's Red Tab"], category: 'fashion', brandColor: '#C41230', domain: 'levi.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: hollisterco.com/shop/eu-nl/help/help-faq and EU Club Cali terms (associate scans the Club Cali ID at checkout); format unknown;
  // CODE_128 guess. Colour: Hollister navy (not machine-checked, site blocked curl).
  { seedKey: 'hollister', name: 'Hollister', aliases: ['Hollister Co.', 'Club Cali', 'HCo'], category: 'fashion', brandColor: '#0A2240', domain: 'hollisterco.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Electronics and games ---

  // Source: mediamarkt.nl/en/service/customer-service/mymediamarkt ("myMediaMarkt QR code in Dutch MediaMarkt stores"). Colour: Commons Media_Markt_logo.svg.
  { seedKey: 'mediamarkt', name: 'MediaMarkt', aliases: ['Media Markt', 'myMediaMarkt'], category: 'electronics', brandColor: '#D9222A', domain: 'mediamarkt.nl', barcodeFormat: 'QR', formatConfidence: 'sourced' },

  // --- Books ---

  // Source: Commons "Primera_spaarpas,_Oude_Pekela_(2019)_02.jpg" shows 2621042231580 (valid EAN check digit, likely EAN-13, but the
  // symbology is not visible), so CODE_128 guess. Colour: primera.nl CSS.
  { seedKey: 'primera', name: 'Primera', aliases: ['PrimeraPas', 'Primera spaarpas'], category: 'books', brandColor: '#FFD500', domain: 'primera.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: Folderz store page (free The Read Shop klantenkaart); format unknown, no public source; CODE_128 guess. Colour: logo red (not machine-checked).
  { seedKey: 'the-read-shop', name: 'The Read Shop', aliases: ['Read Shop', 'Readshop'], category: 'books', brandColor: '#E30613', domain: 'readshop.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: paagman.nl/privilege (Paagman Privilege, digital pass in Apple/Google Wallet, show it at the till); format unknown; CODE_128 guess.
  // Colour: Paagman logo (not machine-checked, site blocked curl).
  { seedKey: 'paagman', name: 'Paagman', aliases: ['Paagman Privilege', 'Boekhandel Paagman'], category: 'books', brandColor: '#1B3A5C', domain: 'paagman.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Sports ---

  // Source: decathlon.nl (digital membership card scanned at the till); format unknown; CODE_128 guess. Colour: Commons Decathlon 2024 logo SVG.
  { seedKey: 'decathlon', name: 'Decathlon', aliases: ['Decathlon member', 'Decathlon klantenkaart'], category: 'sports', brandColor: '#3642B8', domain: 'decathlon.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: intersport.nl (CLUB member, 2.5% saving); format unknown, no public source; CODE_128 guess. Colour: Commons Intersport_logo.svg.
  { seedKey: 'intersport', name: 'INTERSPORT', aliases: ['Intersport CLUB'], category: 'sports', brandColor: '#11448F', domain: 'intersport.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: bever.nl/buitenvriend.html (Bever Card as one way to be a Buitenlid); format unknown; CODE_128 guess. Colour: Commons "Bever Logo.png".
  { seedKey: 'bever', name: 'Bever', aliases: ['Bever Card', 'Buitenvriend', 'Buitenlid'], category: 'sports', brandColor: '#2C4D4B', domain: 'bever.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: jdsports.nl/customer-service/privacy (purchases "waarbij je de JD Status App in de winkel gebruikt"); format unknown;
  // CODE_128 guess. Colour: JD logo black.
  { seedKey: 'jd-sports', name: 'JD Sports', aliases: ['JD'], category: 'sports', brandColor: '#000000', domain: 'jdsports.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: adidas.nl/adiclubrewards and adidas.nl adiClub FAQ (store points need the adidas app); format unknown; CODE_128 guess. Colour: logo black.
  { seedKey: 'adidas', name: 'adidas', aliases: ['adiClub'], category: 'sports', brandColor: '#000000', domain: 'adidas.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Toys ---

  // Source: brickfanatics.com LEGO Insiders guides (physical or digital Insiders card, barcode scanned at LEGO Store checkout; fan site);
  // symbology not stated; CODE_128 guess. Colour: Commons LEGO_logo.svg.
  { seedKey: 'lego', name: 'LEGO', aliases: ['LEGO Insiders', 'LEGO VIP', 'LEGO Store'], category: 'toys', brandColor: '#E3000B', domain: 'lego.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: dreamland.nl/nieuw-merkidentiteit-nieuw-hoofdstuk (former ToyChamp stores; "Je klantenkaart en al je voordelen blijven geldig");
  // format unknown; CODE_128 guess. Colour: dreamland.nl CSS (weak).
  { seedKey: 'dreamland', name: 'DreamLand', aliases: ['ToyChamp', 'DreamLand Plus'], category: 'toys', brandColor: '#F02D2D', domain: 'dreamland.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Pets ---

  // Source: maxizoo.nl/klantenkaart (digital klantenkaart; jumper.nl now redirects here); format unknown; CODE_128 guess. Colour: maxizoo.nl logo markup.
  { seedKey: 'maxi-zoo', name: 'Maxi Zoo', aliases: ['Jumper', 'Maxi Zoo Friends', 'MaxiZoo'], category: 'pets', brandColor: '#196427', domain: 'maxizoo.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: discus.nl/dierenwinkel/nieuwkoop-amsterdam-z-o-1 (free klantenkaart, points towards a €10 voucher); format unknown; CODE_128 guess.
  // Colour: discus.nl CSS.
  { seedKey: 'discus', name: 'Discus', aliases: ['Discus dierenwinkel', 'Discus klantenkaart'], category: 'pets', brandColor: '#257333', domain: 'discus.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: petsplace.nl/acties/hondendag (mentions the Pets Place "Premium klantenkaart"); format unknown; CODE_128 guess. Colour: Commons "Pets Place logo 01.png".
  { seedKey: 'pets-place', name: 'Pets Place', aliases: ['Petsplace', 'Pets Place Premium'], category: 'pets', brandColor: '#DC001B', domain: 'petsplace.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Department stores ---

  // Source: hema.nl (HEMA pas / meer HEMA; the Commons QR photo is only a sign-up code); format unknown; CODE_128 guess. Colour: Commons HEMA_Logo.svg.
  { seedKey: 'hema', name: 'HEMA', aliases: ['HEMA pas', 'meer HEMA'], category: 'department', brandColor: '#E3191C', domain: 'hema.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: debijenkorf.nl 2026 terms (digital or physical klantenpas, Bijenkorf Membership); format unknown; CODE_128 guess. Colour: logo black.
  { seedKey: 'bijenkorf', name: 'de Bijenkorf', aliases: ['Bijenkorf', 'Bijenkorf Membership'], category: 'department', brandColor: '#000000', domain: 'debijenkorf.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: rataplan.nl/?p=18458 ("Dit pasje scan je voortaan tijdens het afrekenen"; second-hand store chain); format unknown; CODE_128 guess.
  // Colour: rataplan.nl logo markup.
  { seedKey: 'rataplan', name: 'RataPlan', aliases: ['RataPlan klantenpas', 'RataPlan kringloop'], category: 'department', brandColor: '#3EA536', domain: 'rataplan.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Fuel ---

  // Source: shell.nl (Shell App / Shell GO+; shell.nl/airmiles.html says Air Miles at Shell ended 31 Oct 2026); format unknown; CODE_128 guess.
  // Colour: Commons Shell_wordmark_2019.svg.
  { seedKey: 'shell', name: 'Shell', aliases: ['Shell GO+', 'Shell App', 'Shell GO plus'], category: 'fuel', brandColor: '#DD1D21', domain: 'shell.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: essoextras.nl and App Store "Esso spaarprogramma" (digital or plastic Extras card); format unknown; CODE_128 guess. Colour: Commons Esso_textlogo.svg.
  { seedKey: 'esso', name: 'Esso', aliases: ['Esso Extras', 'Esso spaarprogramma'], category: 'fuel', brandColor: '#DA0013', domain: 'esso.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: circlek.nl/reward-club (Reward Club, formerly Club TotalEnergies, "digitale pas"); format unknown; CODE_128 guess.
  // Colour: Circle K red (not machine-checked, site page empty).
  { seedKey: 'circle-k', name: 'Circle K', aliases: ['Circle K Reward Club', 'Club TotalEnergies', 'TotalEnergies', 'Total'], category: 'fuel', brandColor: '#EE2722', domain: 'circlek.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: zzp-nederland.nl tankpas pages (Tango spaarprogramma, card linkable to the Tango app); format unknown; CODE_128 guess.
  // Colour: Commons "Tango tankstations logo.png".
  { seedKey: 'tango', name: 'Tango', aliases: ['Tango spaarprogramma', 'Tango app'], category: 'fuel', brandColor: '#E32A26', domain: 'tango.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: bp.com/nl FreeBees actievoorwaarden PDFs (free FreeBees spaarkaart at bp stations or in the BPme app); format unknown;
  // CODE_128 guess. Colour: Commons Bp_textlogo.svg.
  { seedKey: 'bp', name: 'bp', aliases: ['FreeBees', 'BPme'], category: 'fuel', brandColor: '#109A2E', domain: 'bp.com', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: App Store "ViaAVIA" (saving with the app at staffed AVIA stations, plastic card at unstaffed ones); format unknown;
  // CODE_128 guess. Colour: Commons AVIA_International_logo.svg.
  { seedKey: 'avia', name: 'AVIA', aliases: ['ViaAVIA'], category: 'fuel', brandColor: '#ED1C24', domain: 'avia.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },

  // --- Mobility ---

  // Source: kwik-fit.nl/anwb ("met je ANWB lidmaatschapspas profiteer je …"); format unknown; CODE_128 guess. Colour: ANWB yellow, anwb.nl CSS.
  { seedKey: 'anwb', name: 'ANWB', aliases: ['ANWB lidmaatschapspas', 'ANWB Ledenvoordeel', 'Wegenwacht'], category: 'mobility', brandColor: '#FFCD00', domain: 'anwb.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
  // Source: App Store "Loogman - WasApp" (points for every wash at Loogman Carwash; release notes mention QR codes but no scan detail);
  // format unknown; CODE_128 guess. Colour: loogman.nl CSS.
  { seedKey: 'loogman', name: 'Loogman', aliases: ['Loogman Carwash', 'Loogman WasApp', 'Loogman tanken & wassen'], category: 'mobility', brandColor: '#003880', domain: 'loogman.nl', barcodeFormat: 'CODE_128', formatConfidence: 'guess' },
]

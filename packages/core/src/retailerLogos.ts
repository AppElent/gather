/**
 * Retailer logos: which Retailer catalog entries ship a logo file, where each
 * file came from, and how a client finds it (APP-154).
 *
 * The files live in `packages/core/assets/retailer-logos/`, named
 * `<seedKey>-<size>.webp`, one per size in `RETAILER_LOGO_SIZES`. They are
 * prepared once by `scripts/prepare-retailer-logos.mjs` from the `url` below
 * and committed; no client ever fetches a logo from a third party.
 *
 * Logos are used only to say which store a card belongs to (referential use).
 * Each one stays its owner's trademark, whatever the file's copyright licence.
 *
 * A card finds its logo through its `catalogKey` (`retailerLogoKey`). A custom
 * store, or a card whose Catalog entry is gone (ADR-0024), has no logo and
 * keeps the monogram.
 */

export interface RetailerLogoSource {
  /** The file downloaded, once, to prepare the logo. */
  url: string
  /** Where a person can check the source and its licence. */
  page: string
  /** The copyright licence or trademark note, as the source states it. */
  licence: string
  /** The tile colour behind the logo. White unless the logo needs another. */
  background?: string
  /**
   * Empty space on each side, as a fraction of the tile. Defaults to
   * `RETAILER_LOGO_PADDING`; 0 for a logo that is already a square tile.
   */
  padding?: number
}

/** The pixel sizes each logo ships at: 96 for small tiles, 192 for sharp ones. */
export const RETAILER_LOGO_SIZES = [96, 192] as const
export type RetailerLogoSize = (typeof RETAILER_LOGO_SIZES)[number]

/** The most one logo file may weigh, in bytes. */
export const RETAILER_LOGO_MAX_BYTES = 8 * 1024

/** The most all logo files together may weigh, in bytes. */
export const RETAILER_LOGOS_MAX_TOTAL_BYTES = 1024 * 1024

/** Padding for a logo that sets none: a wordmark on a white tile. */
export const RETAILER_LOGO_PADDING = 0.08

/**
 * Every logo, keyed by the Catalog entry's `seedKey`. Wikimedia Commons files
 * are mostly "public domain, trademarked" text logos; an official site icon
 * is the retailer's own app or touch icon. Sources checked on 2026-11-15.
 */
export const RETAILER_LOGOS: Readonly<Record<string, RetailerLogoSource>> = {
  'albert-heijn': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Albert_Heijn_Logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Albert_Heijn_Logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
    padding: 0.08,
  },
  jumbo: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/40/Logo_of_Jumbo_Supermarkten_%282010%29.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Logo_of_Jumbo_Supermarkten_(2010).svg',
    licence: 'Wikimedia Commons, public domain',
  },
  lidl: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Lidl-Logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Lidl-Logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
    padding: 0,
  },
  plus: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/92/PLUS_supermarket_logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:PLUS_supermarket_logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  hoogvliet: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Hoogvliet_logo.png',
    page: 'https://commons.wikimedia.org/wiki/File:Hoogvliet_logo.png',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  vomar: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Logo_Vomar.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Logo_Vomar.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  dekamarkt: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/26/Logo_of_Dekamarkt.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Logo_of_Dekamarkt.svg',
    licence: 'Wikimedia Commons, public domain',
  },
  spar: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Spar-logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Spar-logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  ekoplaza: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/85/Logo_of_Ekoplaza.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Logo_of_Ekoplaza.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  odin: {
    url: 'https://www.odin.nl/site/media/images/apple-touch-icon-114x114.png',
    page: 'https://www.odin.nl/',
    licence: 'Official site icon; trademark of its owner',
  },
  'gall-en-gall': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Gall_logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Gall_logo.svg',
    licence: 'Wikimedia Commons, public domain',
  },
  mitra: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Mitra_Logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Mitra_Logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
    padding: 0,
  },
  makro: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Makro_Europe_logo.png',
    page: 'https://commons.wikimedia.org/wiki/File:Makro_Europe_logo.png',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  sligro: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/30/Logo_of_Sligro_Food_Group.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Logo_of_Sligro_Food_Group.svg',
    licence: 'Wikimedia Commons, public domain',
  },
  hanos: {
    url: 'https://www.hanos.nl/apple-icon.png?apple-icon.0keuhua2-hx62.png',
    page: 'https://www.hanos.nl/',
    licence: 'Official site icon; trademark of its owner',
  },
  kruidvat: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Kruidvat_logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Kruidvat_logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  etos: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Etos_logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Etos_logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  trekpleister: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Trekpleister_Logo_since_2024.webp',
    page: 'https://commons.wikimedia.org/wiki/File:Trekpleister_Logo_since_2024.webp',
    licence: 'Wikimedia Commons, CC0',
  },
  da: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/00/Logo_of_Drogisten_Associatie.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Logo_of_Drogisten_Associatie.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
    padding: 0,
  },
  'holland-and-barrett': {
    url: 'https://dam.hollandandbarrettimages.co.uk/design-system/_raw/6788cf6e-b35c-45b8-abde-1af321f2cda1/icon-512x512.webp',
    page: 'https://www.hollandandbarrett.nl/',
    licence: 'Official site icon; trademark of its owner',
  },
  vitaminstore: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/Vitaminstore_Logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Vitaminstore_Logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  douglas: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/f4/Douglas_Logo_06.2018.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Douglas_Logo_06.2018.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  'ici-paris-xl': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/ea/ICI_Paris_XL_logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:ICI_Paris_XL_logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  rituals: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Rituals_Cosmetics_logo.png',
    page: 'https://commons.wikimedia.org/wiki/File:Rituals_Cosmetics_logo.png',
    licence: 'Wikimedia Commons, public domain; trademarked',
    padding: 0,
  },
  'kiko-milano': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Kiko_Milano_logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Kiko_Milano_logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  gamma: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Gamma_logo_2010.png',
    page: 'https://commons.wikimedia.org/wiki/File:Gamma_logo_2010.png',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  karwei: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/55/Karwei_logo_%282017%29.png',
    page: 'https://commons.wikimedia.org/wiki/File:Karwei_logo_(2017).png',
    licence: 'Wikimedia Commons, public domain; trademarked',
    padding: 0.06,
  },
  praxis: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/f8/Praxis_logo_2018.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Praxis_logo_2018.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
    background: '#E20019',
  },
  hubo: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/ad/Hubo_Netherlands_logo_2017.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Hubo_Netherlands_logo_2017.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
    background: '#1F2937',
  },
  bouwmaat: {
    url: 'https://www.bouwmaat.nl/cdn/shop/files/download.svg',
    page: 'https://www.bouwmaat.nl/',
    licence: 'Official site icon; trademark of its owner',
  },
  welkoop: {
    url: 'https://www.welkoop.nl/mobify/bundle/1006/static/img/global/apple-touch-icon.png',
    page: 'https://www.welkoop.nl/',
    licence: 'Official site icon; trademark of its owner',
  },
  groenrijk: {
    url: 'https://www.groenrijk.nl/files/images/icons/cd27a0b7e9/apple-touch-icon-precomposed.png',
    page: 'https://www.groenrijk.nl/',
    licence: 'Official site icon; trademark of its owner',
  },
  'life-and-garden': {
    url: 'https://www.lifeandgarden.com/files/images/icons/5e31188c66/apple-touch-icon-precomposed.png',
    page: 'https://www.lifeandgarden.com/',
    licence: 'Official site icon; trademark of its owner',
  },
  ikea: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Ikea_logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Ikea_logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  action: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Action_Nederland_Logo_2020.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Action_Nederland_Logo_2020.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  xenos: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a3/Logo-Xenos-Rubin-Red.png',
    page: 'https://commons.wikimedia.org/wiki/File:Logo-Xenos-Rubin-Red.png',
    licence: 'Wikimedia Commons, public domain',
  },
  'flying-tiger': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Flying_Tiger_Copenhagen.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Flying_Tiger_Copenhagen.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  blokker: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Blokker-Logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Blokker-Logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  jysk: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Jysk_logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Jysk_logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  'c-en-a': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/af/C%26A_logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:C%26A_logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  'h-en-m': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/53/H%26M-Logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:H%26M-Logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  hunkemoller: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/99/Hunkemoeller_Logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Hunkemoeller_Logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  shoeby: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Shoeby-logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Shoeby-logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  only: {
    url: 'https://www.only.com/apple-touch-icon.png',
    page: 'https://www.only.com/',
    licence: 'Official site icon; trademark of its owner',
  },
  'jack-en-jones': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Jack_%26_Jones_logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Jack_%26_Jones_logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  'vero-moda': {
    url: 'https://www.veromoda.com/apple-touch-icon.png',
    page: 'https://www.veromoda.com/',
    licence: 'Official site icon; trademark of its owner',
  },
  mango: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Logo_of_Mango_%28new%29.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Logo_of_Mango_(new).svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  vanharen: {
    url: 'https://www.vanharen.nl/nl-nl/assets/concepts/VHA/icons/apple-touch-icon-180x180.png',
    page: 'https://www.vanharen.nl/',
    licence: 'Official site icon; trademark of its owner',
  },
  scapino: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Scapino_logo_02.png',
    page: 'https://commons.wikimedia.org/wiki/File:Scapino_logo_02.png',
    licence: 'Wikimedia Commons, public domain; trademarked',
    padding: 0,
  },
  nelson: {
    url: 'https://www.nelson.nl/static/icons/ios-icon.png',
    page: 'https://www.nelson.nl/',
    licence: 'Official site icon; trademark of its owner',
  },
  sacha: {
    url: 'https://www.sacha.nl/apple-touch-icon.png',
    page: 'https://www.sacha.nl/',
    licence: 'Official site icon; trademark of its owner',
  },
  manfield: {
    url: 'https://www.manfield.com/apple-touch-icon.png',
    page: 'https://www.manfield.com/',
    licence: 'Official site icon; trademark of its owner',
  },
  ecco: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/92/Ecco_shoes_logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Ecco_shoes_logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  snipes: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Snipes_logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Snipes_logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  lucardi: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/6/63/Lucardi_Logo_2023.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Lucardi_Logo_2023.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  takko: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/c0/TakkoLogo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:TakkoLogo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  'we-fashion': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/35/WE_Fashion_Logo_03.2022.svg',
    page: 'https://commons.wikimedia.org/wiki/File:WE_Fashion_Logo_03.2022.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  'peek-cloppenburg': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/27/Logo_Peek_%26_Cloppenburg.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Logo_Peek_%26_Cloppenburg.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  levis: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/75/Levi%27s_logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Levi%27s_logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  hollister: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Logo_wordmark_Hollister_Co._%282025%29_USA.png',
    page: 'https://commons.wikimedia.org/wiki/File:Logo_wordmark_Hollister_Co._(2025)_USA.png',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  mediamarkt: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Media_Markt_logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Media_Markt_logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  'the-read-shop': {
    url: 'https://www.readshop.nl/client/6.55.0-9145/assets/apple-touch-icon.png',
    page: 'https://www.readshop.nl/',
    licence: 'Official site icon; trademark of its owner',
  },
  paagman: {
    url: 'https://www.paagman.nl/apple-touch-icon.png',
    page: 'https://www.paagman.nl/',
    licence: 'Official site icon; trademark of its owner',
  },
  decathlon: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Decathlon_-_logo_%28France%2C_2024%29.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Decathlon_-_logo_(France,_2024).svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  intersport: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Intersport_logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Intersport_logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  bever: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/6/67/Bever_Logo.png',
    page: 'https://commons.wikimedia.org/wiki/File:Bever_Logo.png',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  'jd-sports': {
    url: 'https://www.jdsports.nl/apple-touch-icon.png',
    page: 'https://www.jdsports.nl/',
    licence: 'Official site icon; trademark of its owner',
  },
  adidas: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/20/Adidas_Logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Adidas_Logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  lego: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/24/LEGO_logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:LEGO_logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
    padding: 0,
  },
  'maxi-zoo': {
    url: 'https://cdn.prod.website-files.com/63172f5ac8e9d5bdce585af3/669a4bef8f2432b424b9e695_MZ_logo_web_groot.png',
    page: 'https://www.maxizoo.nl/',
    licence: 'Official site icon; trademark of its owner',
  },
  'pets-place': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/96/Pets_Place_logo_01.png',
    page: 'https://commons.wikimedia.org/wiki/File:Pets_Place_logo_01.png',
    licence: 'Wikimedia Commons, public domain; trademarked',
    padding: 0,
  },
  hema: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/57/HEMA_Logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:HEMA_Logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
    padding: 0,
  },
  bijenkorf: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/fd/De_Bijenkorf_logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:De_Bijenkorf_logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  rataplan: {
    url: 'https://rataplan.nl/wp-content/uploads/2016/01/cropped-RataPlan-kringloop-icoon-1-180x180.png',
    page: 'https://www.rataplan.nl/',
    licence: 'Official site icon; trademark of its owner',
  },
  shell: {
    url: 'https://www.shell.nl/etc.clientlibs/amidala/clientlibs/theme-base/resources/favicon/apple-touch-icon.png',
    page: 'https://www.shell.nl/',
    licence: 'Official site icon; trademark of its owner',
  },
  esso: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/22/Esso_textlogo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Esso_textlogo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  'circle-k': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Circle_K_logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:Circle_K_logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
    padding: 0,
  },
  tango: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/96/Tango_tankstations_logo.png',
    page: 'https://commons.wikimedia.org/wiki/File:Tango_tankstations_logo.png',
    licence: 'Wikimedia Commons, public domain; trademarked',
    padding: 0.02,
  },
  bp: {
    url: 'https://www.bp.com/icon.svg',
    page: 'https://www.bp.com/',
    licence: 'Official site icon; trademark of its owner',
  },
  avia: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/c0/AVIA_International_logo.svg',
    page: 'https://commons.wikimedia.org/wiki/File:AVIA_International_logo.svg',
    licence: 'Wikimedia Commons, public domain; trademarked',
  },
  anwb: {
    url: 'https://www.anwb.nl/common/assets/anwb-icon-512.png',
    page: 'https://www.anwb.nl/',
    licence: 'Official site icon; trademark of its owner',
  },
  loogman: {
    url: 'https://www.loogman.nl/wp-content/uploads/2024/03/cropped-Loogman_Fav_2-180x180.png',
    page: 'https://www.loogman.nl/',
    licence: 'Official site icon; trademark of its owner',
  },
}

/**
 * Catalog entries without a logo, and why. They keep the monogram. A test
 * holds every Catalog `seedKey` in exactly one of the two lists.
 */
export const RETAILERS_WITHOUT_LOGO: Readonly<Record<string, string>> = {
  intratuin:
    'No logo on Wikimedia Commons, and intratuin.nl publishes no app or touch icon.',
  tuinland:
    'No logo on Wikimedia Commons, and tuinland.nl publishes no app or touch icon.',
  ziengs:
    'No logo on Wikimedia Commons, and the icon ziengs.nl publishes does not show the brand.',
  livera:
    'No logo on Wikimedia Commons, and livera.nl publishes no app or touch icon.',
  primera:
    'No logo on Wikimedia Commons, and primera.nl publishes no app or touch icon.',
  dreamland:
    'No logo on Wikimedia Commons, and dreamland.nl refused the download (HTTP 403).',
  discus:
    'No logo on Wikimedia Commons, and discus.nl publishes no app or touch icon.',
}

/**
 * The logo a card or Catalog entry shows, as the `seedKey` its files are named
 * after, or null for the monogram. Only a key with a shipped logo answers, so
 * a custom store or a dangling Provenance falls back without a broken image.
 */
export function retailerLogoKey(
  catalogKey: string | null | undefined,
): string | null {
  if (!catalogKey) return null
  return Object.hasOwn(RETAILER_LOGOS, catalogKey) ? catalogKey : null
}

/** A logo file's name in `packages/core/assets/retailer-logos/`. */
export function retailerLogoFileName(
  seedKey: string,
  size: RetailerLogoSize,
): string {
  return `${seedKey}-${size}.webp`
}

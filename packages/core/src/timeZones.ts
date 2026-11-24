/**
 * IANA time zone names: reading this device's, naming one canonically, and
 * listing the ones somebody can choose.
 */
import { isTimeZone } from './taskReminders'

/** This device's IANA zone; UTC when the runtime cannot say. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * The zone this runtime resolves an IANA name to (`europe/amsterdam` is
 * `Europe/Amsterdam`), or null for anything else. `Intl` also takes an offset,
 * with an ASCII or a Unicode minus (`+01:00`, U+2212), which is not a name.
 */
export function canonicalTimeZone(value: string): string | null {
  if (!/^[A-Za-z]/.test(value) || !isTimeZone(value)) return null
  return new Intl.DateTimeFormat('en-US', {
    timeZone: value,
  }).resolvedOptions().timeZone
}

/**
 * Whether two names are one zone. The server stores its own runtime's
 * canonical name, which can be another alias than this device's
 * (`Asia/Calcutta`, `Asia/Kolkata`).
 */
export function sameTimeZone(a: string | undefined, b: string): boolean {
  if (a === undefined) return false
  if (a === b) return true
  const canonical = canonicalTimeZone(a)
  return canonical !== null && canonical === canonicalTimeZone(b)
}

/**
 * Every zone that can be chosen: the runtime's list, or the IANA one where it
 * has none (the phone's Hermes), always with UTC and the zones in `also`.
 */
export function listTimeZones(...also: (string | undefined)[]): string[] {
  let listed: readonly string[] = IANA_ZONES
  try {
    const supported = Intl.supportedValuesOf('timeZone')
    if (supported.length > 0) listed = supported
  } catch {
    // Not here: the IANA list.
  }
  return [
    ...new Set([
      ...listed,
      'UTC',
      ...also.filter((zone) => zone !== undefined),
    ]),
  ].sort()
}

/**
 * The zones whose name holds every word typed. `_` and `/` count as spaces, so
 * "new york" finds `America/New_York`.
 */
export function searchTimeZones(
  zones: readonly string[],
  query: string,
): string[] {
  const words = plain(query).split(' ').filter(Boolean)
  return zones.filter((zone) => {
    const name = plain(zone)
    return words.every((word) => name.includes(word))
  })
}

function plain(text: string): string {
  return text.toLowerCase().replace(/[_/\s]+/g, ' ').trim()
}

/** The zones in the IANA database's `zone.tab`, and UTC. */
const IANA_ZONES = `
Africa/Abidjan Africa/Accra Africa/Addis_Ababa Africa/Algiers Africa/Asmara
Africa/Bamako Africa/Bangui Africa/Banjul Africa/Bissau Africa/Blantyre
Africa/Brazzaville Africa/Bujumbura Africa/Cairo Africa/Casablanca
Africa/Ceuta Africa/Conakry Africa/Dakar Africa/Dar_es_Salaam Africa/Djibouti
Africa/Douala Africa/El_Aaiun Africa/Freetown Africa/Gaborone Africa/Harare
Africa/Johannesburg Africa/Juba Africa/Kampala Africa/Khartoum Africa/Kigali
Africa/Kinshasa Africa/Lagos Africa/Libreville Africa/Lome Africa/Luanda
Africa/Lubumbashi Africa/Lusaka Africa/Malabo Africa/Maputo Africa/Maseru
Africa/Mbabane Africa/Mogadishu Africa/Monrovia Africa/Nairobi Africa/Ndjamena
Africa/Niamey Africa/Nouakchott Africa/Ouagadougou Africa/Porto-Novo
Africa/Sao_Tome Africa/Tripoli Africa/Tunis Africa/Windhoek America/Adak
America/Anchorage America/Anguilla America/Antigua America/Araguaina
America/Argentina/Buenos_Aires America/Argentina/Catamarca
America/Argentina/Cordoba America/Argentina/Jujuy America/Argentina/La_Rioja
America/Argentina/Mendoza America/Argentina/Rio_Gallegos
America/Argentina/Salta America/Argentina/San_Juan America/Argentina/San_Luis
America/Argentina/Tucuman America/Argentina/Ushuaia America/Aruba
America/Asuncion America/Atikokan America/Bahia America/Bahia_Banderas
America/Barbados America/Belem America/Belize America/Blanc-Sablon
America/Boa_Vista America/Bogota America/Boise America/Cambridge_Bay
America/Campo_Grande America/Cancun America/Caracas America/Cayenne
America/Cayman America/Chicago America/Chihuahua America/Ciudad_Juarez
America/Costa_Rica America/Coyhaique America/Creston America/Cuiaba
America/Curacao America/Danmarkshavn America/Dawson America/Dawson_Creek
America/Denver America/Detroit America/Dominica America/Edmonton
America/Eirunepe America/El_Salvador America/Fort_Nelson America/Fortaleza
America/Glace_Bay America/Goose_Bay America/Grand_Turk America/Grenada
America/Guadeloupe America/Guatemala America/Guayaquil America/Guyana
America/Halifax America/Havana America/Hermosillo America/Indiana/Indianapolis
America/Indiana/Knox America/Indiana/Marengo America/Indiana/Petersburg
America/Indiana/Tell_City America/Indiana/Vevay America/Indiana/Vincennes
America/Indiana/Winamac America/Inuvik America/Iqaluit America/Jamaica
America/Juneau America/Kentucky/Louisville America/Kentucky/Monticello
America/Kralendijk America/La_Paz America/Lima America/Los_Angeles
America/Lower_Princes America/Maceio America/Managua America/Manaus
America/Marigot America/Martinique America/Matamoros America/Mazatlan
America/Menominee America/Merida America/Metlakatla America/Mexico_City
America/Miquelon America/Moncton America/Monterrey America/Montevideo
America/Montserrat America/Nassau America/New_York America/Nome
America/Noronha America/North_Dakota/Beulah America/North_Dakota/Center
America/North_Dakota/New_Salem America/Nuuk America/Ojinaga America/Panama
America/Paramaribo America/Phoenix America/Port-au-Prince
America/Port_of_Spain America/Porto_Velho America/Puerto_Rico
America/Punta_Arenas America/Rankin_Inlet America/Recife America/Regina
America/Resolute America/Rio_Branco America/Santarem America/Santiago
America/Santo_Domingo America/Sao_Paulo America/Scoresbysund America/Sitka
America/St_Barthelemy America/St_Johns America/St_Kitts America/St_Lucia
America/St_Thomas America/St_Vincent America/Swift_Current America/Tegucigalpa
America/Thule America/Tijuana America/Toronto America/Tortola
America/Vancouver America/Whitehorse America/Winnipeg America/Yakutat
Antarctica/Casey Antarctica/Davis Antarctica/DumontDUrville
Antarctica/Macquarie Antarctica/Mawson Antarctica/McMurdo Antarctica/Palmer
Antarctica/Rothera Antarctica/Syowa Antarctica/Troll Antarctica/Vostok
Arctic/Longyearbyen Asia/Aden Asia/Almaty Asia/Amman Asia/Anadyr Asia/Aqtau
Asia/Aqtobe Asia/Ashgabat Asia/Atyrau Asia/Baghdad Asia/Bahrain Asia/Baku
Asia/Bangkok Asia/Barnaul Asia/Beirut Asia/Bishkek Asia/Brunei Asia/Chita
Asia/Colombo Asia/Damascus Asia/Dhaka Asia/Dili Asia/Dubai Asia/Dushanbe
Asia/Famagusta Asia/Gaza Asia/Hebron Asia/Ho_Chi_Minh Asia/Hong_Kong Asia/Hovd
Asia/Irkutsk Asia/Jakarta Asia/Jayapura Asia/Jerusalem Asia/Kabul
Asia/Kamchatka Asia/Karachi Asia/Kathmandu Asia/Khandyga Asia/Kolkata
Asia/Krasnoyarsk Asia/Kuala_Lumpur Asia/Kuching Asia/Kuwait Asia/Macau
Asia/Magadan Asia/Makassar Asia/Manila Asia/Muscat Asia/Nicosia
Asia/Novokuznetsk Asia/Novosibirsk Asia/Omsk Asia/Oral Asia/Phnom_Penh
Asia/Pontianak Asia/Pyongyang Asia/Qatar Asia/Qostanay Asia/Qyzylorda
Asia/Riyadh Asia/Sakhalin Asia/Samarkand Asia/Seoul Asia/Shanghai
Asia/Singapore Asia/Srednekolymsk Asia/Taipei Asia/Tashkent Asia/Tbilisi
Asia/Tehran Asia/Thimphu Asia/Tokyo Asia/Tomsk Asia/Ulaanbaatar Asia/Urumqi
Asia/Ust-Nera Asia/Vientiane Asia/Vladivostok Asia/Yakutsk Asia/Yangon
Asia/Yekaterinburg Asia/Yerevan Atlantic/Azores Atlantic/Bermuda
Atlantic/Canary Atlantic/Cape_Verde Atlantic/Faroe Atlantic/Madeira
Atlantic/Reykjavik Atlantic/South_Georgia Atlantic/St_Helena Atlantic/Stanley
Australia/Adelaide Australia/Brisbane Australia/Broken_Hill Australia/Darwin
Australia/Eucla Australia/Hobart Australia/Lindeman Australia/Lord_Howe
Australia/Melbourne Australia/Perth Australia/Sydney Europe/Amsterdam
Europe/Andorra Europe/Astrakhan Europe/Athens Europe/Belgrade Europe/Berlin
Europe/Bratislava Europe/Brussels Europe/Bucharest Europe/Budapest
Europe/Busingen Europe/Chisinau Europe/Copenhagen Europe/Dublin
Europe/Gibraltar Europe/Guernsey Europe/Helsinki Europe/Isle_of_Man
Europe/Istanbul Europe/Jersey Europe/Kaliningrad Europe/Kirov Europe/Kyiv
Europe/Lisbon Europe/Ljubljana Europe/London Europe/Luxembourg Europe/Madrid
Europe/Malta Europe/Mariehamn Europe/Minsk Europe/Monaco Europe/Moscow
Europe/Oslo Europe/Paris Europe/Podgorica Europe/Prague Europe/Riga
Europe/Rome Europe/Samara Europe/San_Marino Europe/Sarajevo Europe/Saratov
Europe/Simferopol Europe/Skopje Europe/Sofia Europe/Stockholm Europe/Tallinn
Europe/Tirane Europe/Ulyanovsk Europe/Vaduz Europe/Vatican Europe/Vienna
Europe/Vilnius Europe/Volgograd Europe/Warsaw Europe/Zagreb Europe/Zurich
Indian/Antananarivo Indian/Chagos Indian/Christmas Indian/Cocos Indian/Comoro
Indian/Kerguelen Indian/Mahe Indian/Maldives Indian/Mauritius Indian/Mayotte
Indian/Reunion Pacific/Apia Pacific/Auckland Pacific/Bougainville
Pacific/Chatham Pacific/Chuuk Pacific/Easter Pacific/Efate Pacific/Fakaofo
Pacific/Fiji Pacific/Funafuti Pacific/Galapagos Pacific/Gambier
Pacific/Guadalcanal Pacific/Guam Pacific/Honolulu Pacific/Kanton
Pacific/Kiritimati Pacific/Kosrae Pacific/Kwajalein Pacific/Majuro
Pacific/Marquesas Pacific/Midway Pacific/Nauru Pacific/Niue Pacific/Norfolk
Pacific/Noumea Pacific/Pago_Pago Pacific/Palau Pacific/Pitcairn
Pacific/Pohnpei Pacific/Port_Moresby Pacific/Rarotonga Pacific/Saipan
Pacific/Tahiti Pacific/Tarawa Pacific/Tongatapu Pacific/Wake Pacific/Wallis
UTC
`
  .trim()
  .split(/\s+/)

// Flag + currency for every country people actually travel to, so a new destination gets the right flag,
// default currency and a suggestion in the add form without code changes (no import: unit-tested).
// Format: "Name|ISO2|CURRENCY". The flag emoji is derived from the ISO code.

const RAW = `Afghanistan|AF|AFN;Albania|AL|ALL;Algeria|DZ|DZD;Andorra|AD|EUR;Angola|AO|AOA;Argentina|AR|ARS;Armenia|AM|AMD;Austria|AT|EUR;Azerbaijan|AZ|AZN;Bahamas|BS|BSD;Bahrain|BH|BHD;Bangladesh|BD|BDT;Barbados|BB|BBD;Belarus|BY|BYN;Belgium|BE|EUR;Belize|BZ|BZD;Bhutan|BT|BTN;Bolivia|BO|BOB;Bosnia and Herzegovina|BA|BAM;Botswana|BW|BWP;Brazil|BR|BRL;Brunei|BN|BND;Bulgaria|BG|BGN;Cambodia|KH|KHR;Cameroon|CM|XAF;Canada|CA|CAD;Cape Verde|CV|CVE;Chile|CL|CLP;Colombia|CO|COP;Costa Rica|CR|CRC;Croatia|HR|EUR;Cuba|CU|CUP;Cyprus|CY|EUR;Czech Republic|CZ|CZK;Denmark|DK|DKK;Dominican Republic|DO|DOP;Ecuador|EC|USD;Egypt|EG|EGP;El Salvador|SV|USD;Estonia|EE|EUR;Ethiopia|ET|ETB;Fiji|FJ|FJD;Finland|FI|EUR;Georgia|GE|GEL;Germany|DE|EUR;Ghana|GH|GHS;Greece|GR|EUR;Guatemala|GT|GTQ;Honduras|HN|HNL;Hong Kong|HK|HKD;Hungary|HU|HUF;Iceland|IS|ISK;India|IN|INR;Iran|IR|IRR;Iraq|IQ|IQD;Ireland|IE|EUR;Israel|IL|ILS;Jamaica|JM|JMD;Jordan|JO|JOD;Kazakhstan|KZ|KZT;Kenya|KE|KES;Kuwait|KW|KWD;Kyrgyzstan|KG|KGS;Laos|LA|LAK;Latvia|LV|EUR;Lebanon|LB|LBP;Libya|LY|LYD;Lithuania|LT|EUR;Luxembourg|LU|EUR;Macau|MO|MOP;Madagascar|MG|MGA;Maldives|MV|MVR;Malta|MT|EUR;Mauritius|MU|MUR;Mexico|MX|MXN;Moldova|MD|MDL;Monaco|MC|EUR;Mongolia|MN|MNT;Montenegro|ME|EUR;Morocco|MA|MAD;Mozambique|MZ|MZN;Myanmar|MM|MMK;Namibia|NA|NAD;Nepal|NP|NPR;Netherlands|NL|EUR;New Zealand|NZ|NZD;Nicaragua|NI|NIO;Nigeria|NG|NGN;North Macedonia|MK|MKD;Norway|NO|NOK;Oman|OM|OMR;Pakistan|PK|PKR;Panama|PA|PAB;Papua New Guinea|PG|PGK;Paraguay|PY|PYG;Peru|PE|PEN;Philippines|PH|PHP;Poland|PL|PLN;Portugal|PT|EUR;Qatar|QA|QAR;Romania|RO|RON;Russia|RU|RUB;Rwanda|RW|RWF;Saudi Arabia|SA|SAR;Senegal|SN|XOF;Serbia|RS|RSD;Seychelles|SC|SCR;Slovakia|SK|EUR;Slovenia|SI|EUR;South Africa|ZA|ZAR;South Korea|KR|KRW;Spain|ES|EUR;Sri Lanka|LK|LKR;Sweden|SE|SEK;Tajikistan|TJ|TJS;Tanzania|TZ|TZS;Tunisia|TN|TND;Turkmenistan|TM|TMT;Uganda|UG|UGX;Ukraine|UA|UAH;United Arab Emirates|AE|AED;United States|US|USD;Uruguay|UY|UYU;Uzbekistan|UZ|UZS;Vatican City|VA|EUR;Venezuela|VE|VES;Zambia|ZM|ZMW;Zimbabwe|ZW|USD`;

export interface WorldCountry {
  name: string;
  slug: string;
  flag: string;
  currency: string;
}

export const flagOf = (iso2: string) =>
  [...iso2.toUpperCase()].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('');

const slugOf = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const WORLD_COUNTRIES: WorldCountry[] = RAW.split(';').map((row) => {
  const [name, iso, currency] = row.split('|');
  return { name, slug: slugOf(name), flag: flagOf(iso), currency };
});

const BY_SLUG = new Map(WORLD_COUNTRIES.map((c) => [c.slug, c]));

/** Flag and currency for a country slug the built-in defaults don't know, or undefined. */
export const worldCountry = (slug: string): WorldCountry | undefined => BY_SLUG.get(slug);

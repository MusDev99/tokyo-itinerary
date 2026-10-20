/** AlAdhan calculation methods by country: the local standard where one exists, MWL elsewhere. */
export interface PrayerMethod {
  id: number;
  name: string;
}

const METHODS: Record<string, PrayerMethod> = {
  MY: { id: 17, name: 'JAKIM (Malaysia)' },
  ID: { id: 20, name: 'Kemenag (Indonesia)' },
  SG: { id: 11, name: 'MUIS (Singapore)' },
  TR: { id: 13, name: 'Diyanet (Türkiye)' },
  SA: { id: 4, name: 'Umm al-Qura (Saudi Arabia)' },
  AE: { id: 16, name: 'Dubai (UAE)' },
  EG: { id: 5, name: 'Egyptian General Authority' },
  MA: { id: 21, name: 'Morocco' },
  KW: { id: 9, name: 'Kuwait' },
  QA: { id: 10, name: 'Qatar' },
  PK: { id: 1, name: 'Univ. of Islamic Sciences, Karachi' },
};

export const DEFAULT_METHOD: PrayerMethod = { id: 3, name: 'Muslim World League' };

export function methodForCountry(countryCode: string | undefined): PrayerMethod {
  return (countryCode && METHODS[countryCode.toUpperCase()]) || DEFAULT_METHOD;
}

export const PRAYERS = [
  { key: 'Fajr', label: 'Subuh' },
  { key: 'Sunrise', label: 'Syuruk' },
  { key: 'Dhuhr', label: 'Zohor' },
  { key: 'Asr', label: 'Asar' },
  { key: 'Maghrib', label: 'Maghrib' },
  { key: 'Isha', label: 'Isyak' },
] as const;

export type PrayerKey = (typeof PRAYERS)[number]['key'];
export type DayTimings = { date: string } & Record<PrayerKey, string>;

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compassPoint = (deg: number) => COMPASS[Math.round(((deg % 360) / 22.5)) % 16];

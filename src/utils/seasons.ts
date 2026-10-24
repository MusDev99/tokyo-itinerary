/** `group` chunks the picker into Seasons and Weather (Miller's Law). */
export const SEASONS = [
  { id: 'autumn', label: 'Autumn', icon: '🍂', group: 'season' },
  { id: 'winter', label: 'Winter', icon: '❄️', group: 'season' },
  { id: 'spring', label: 'Spring', icon: '🌸', group: 'season' },
  { id: 'summer', label: 'Summer', icon: '☀️', group: 'season' },
  { id: 'rain', label: 'Rain', icon: '🌧️', group: 'weather' },
  { id: 'haze', label: 'Haze', icon: '🌫️', group: 'weather' },
  { id: 'night', label: 'Starry Night', icon: '🌙', group: 'weather' },
] as const;

export type SeasonId = (typeof SEASONS)[number]['id'];

export const DEFAULT_SEASON: SeasonId = 'autumn';

export function isSeason(value: unknown): value is SeasonId {
  return SEASONS.some((s) => s.id === value);
}

export function readSavedSeason(): SeasonId {
  try {
    const saved = localStorage.getItem('theme');
    return isSeason(saved) ? saved : DEFAULT_SEASON;
  } catch {
    return DEFAULT_SEASON;
  }
}

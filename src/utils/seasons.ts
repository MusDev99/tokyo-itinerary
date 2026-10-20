export const SEASONS = [
  { id: 'autumn', label: 'Autumn', icon: '🍂' },
  { id: 'winter', label: 'Winter', icon: '❄️' },
  { id: 'spring', label: 'Spring', icon: '🌸' },
  { id: 'summer', label: 'Summer', icon: '☀️' },
  { id: 'rain', label: 'Rain', icon: '🌧️' },
  { id: 'haze', label: 'Haze', icon: '🌫️' },
  { id: 'night', label: 'Starry Night', icon: '🌙' },
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

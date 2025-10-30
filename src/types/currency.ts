export interface CurrencyExchangeData {
  direction_color?: string;
  rowDate: string;
  rowDateRaw?: number;
  rowDateTimestamp?: string;
  last_close?: string;
  last_open?: string;
  last_max?: string;
  last_min?: string;
  volume?: string;
  volumeRaw?: number;
  change_precent?: string;
  change_precentRaw?: number;

  // These are the ones the component is actually using and parsing
  last_closeRaw: string;
  last_openRaw: string;
  last_maxRaw: string;
  last_minRaw: string;
}

export interface HistoricalCurrencyResponse {
  data: CurrencyExchangeData[];
  statusCode?: number;
  message?: string;
}
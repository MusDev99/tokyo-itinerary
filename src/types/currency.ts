export interface CurrencyExchangeData {
  rowDate: string;
  last_closeRaw: string;
  last_close?: string;
  last_max?: string;
  last_min?: string;
  last_open?: string;
}

export interface HistoricalCurrencyResponse {
  data: CurrencyExchangeData[];
  statusCode?: number;
  message?: string;
}
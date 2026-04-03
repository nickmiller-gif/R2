export type UtcDateInput = Date | string | number;

export interface TimeWindow {
  start: Date | null;
  end: Date | null;
}

export interface ValidityWindow {
  validFrom: Date | null;
  validTo: Date | null;
}

export type StatusIndicator = 'none' | 'minor' | 'major' | 'critical' | 'maintenance';

export interface StatusPageStatus {
  indicator: StatusIndicator;
  description: string;
}

export interface StatusPageSummaryResponse {
  status: StatusPageStatus;
}

export interface NormalizedStatus {
  companyId:   string;
  slug:        string;
  indicator:   StatusIndicator;
  description: string;
  fetchedAt:   Date;
}

export interface FetchResult {
  companyId: string;
  slug:      string;
  ok:        boolean;
  status?:   NormalizedStatus;
  error?:    string;
}

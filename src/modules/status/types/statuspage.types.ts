export type StatusIndicator = 'none' | 'minor' | 'major' | 'critical' | 'maintenance';

export type ComponentStatus =
  | 'operational'
  | 'degraded_performance'
  | 'partial_outage'
  | 'major_outage'
  | 'under_maintenance';

export interface StatusPageStatus {
  indicator: StatusIndicator;
  description: string;
}

export interface StatusPageComponent {
  id:     string;
  name:   string;
  status: ComponentStatus;
}

export interface StatusPageSummaryResponse {
  status:     StatusPageStatus;
  components: StatusPageComponent[];
}

export interface NormalizedComponent {
  id:     string;
  name:   string;
  status: ComponentStatus;
}

export interface NormalizedStatus {
  companyId:   string;
  slug:        string;
  indicator:   StatusIndicator;
  description: string;
  components:  NormalizedComponent[];
  fetchedAt:   Date;
}

export interface FetchResult {
  companyId: string;
  slug:      string;
  ok:        boolean;
  status?:   NormalizedStatus;
  error?:    string;
}

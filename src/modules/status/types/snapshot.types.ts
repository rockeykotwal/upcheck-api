import type { ObjectId } from 'mongodb';
import type { StatusIndicator, NormalizedComponent } from './statuspage.types';

export interface StatusSnapshot {
  _id?:        ObjectId;
  companyId:   string;
  slug:        string;
  indicator:   StatusIndicator;
  description: string;
  components:  NormalizedComponent[];
  fetchedAt:   Date;
}

export interface UptimeStats {
  h24: number;
  d7:  number;
  d30: number;
}

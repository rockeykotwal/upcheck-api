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
  h1:  number;
  h12: number;
}

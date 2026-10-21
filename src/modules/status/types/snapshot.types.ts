import type { ObjectId } from 'mongodb';
import type { StatusIndicator } from './statuspage.types';

export interface StatusSnapshot {
  _id?:        ObjectId;
  companyId:   string;
  slug:        string;
  indicator:   StatusIndicator;
  description: string;
  fetchedAt:   Date;
}

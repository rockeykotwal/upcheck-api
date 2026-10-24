import type { ObjectId } from 'mongodb';
import type { StatusIndicator } from './statuspage.types';

export interface Postmortem {
  _id?: ObjectId;
  slug: string;
  companyId: string;
  startedAt: Date;
  resolvedAt: Date;
  durationMinutes: number;
  peakIndicator: StatusIndicator;
  snapshotCount: number;
  summary: string;
  createdAt: Date;
}

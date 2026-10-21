import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusService } from '../../../src/modules/status/services/StatusService';
import type { CompanyRepository } from '../../../src/modules/status/repositories/CompanyRepository';
import type { SnapshotRepository } from '../../../src/modules/status/repositories/SnapshotRepository';
import type { Company } from '../../../src/modules/status/models/company.schema';
import type { StatusSnapshot } from '../../../src/modules/status/types/snapshot.types';

function makeCompany(slug: string, name: string): Company {
  return { id: `id-${slug}`, slug, name, statusPageUrl: `https://${slug}.statuspage.io` } as Company;
}

function makeSnapshot(slug: string): StatusSnapshot {
  return { companyId: `id-${slug}`, slug, indicator: 'none', description: 'All Systems Operational', fetchedAt: new Date() };
}

function buildService(companies: Company[], latestSnapshot: StatusSnapshot | null = null, recentSnapshots: StatusSnapshot[] = []) {
  const companiesRepo = {
    findAll:     vi.fn().mockResolvedValue(companies),
    findBySlug:  vi.fn().mockImplementation((slug: string) =>
      Promise.resolve(companies.find((c) => c.slug === slug) ?? null),
    ),
  } as unknown as CompanyRepository;

  const snapshotsRepo = {
    findLatestBySlug: vi.fn().mockResolvedValue(latestSnapshot),
    findRecentBySlug: vi.fn().mockResolvedValue(recentSnapshots),
  } as unknown as SnapshotRepository;

  const service = new StatusService(companiesRepo, snapshotsRepo);
  return { service, companiesRepo, snapshotsRepo };
}

describe('StatusService.listAll', () => {
  it('returns all companies with their latest snapshot', async () => {
    const companies = [makeCompany('github', 'GitHub'), makeCompany('stripe', 'Stripe')];
    const { service, snapshotsRepo } = buildService(companies, makeSnapshot('github'));

    const result = await service.listAll();

    expect(result).toHaveLength(2);
    expect(result[0]!.company.slug).toBe('github');
    expect(snapshotsRepo.findLatestBySlug).toHaveBeenCalledTimes(2);
  });

  it('returns null current snapshot when none exists', async () => {
    const { service } = buildService([makeCompany('github', 'GitHub')], null);

    const result = await service.listAll();

    expect(result[0]!.current).toBeNull();
  });

  it('returns empty array when no companies exist', async () => {
    const { service } = buildService([]);

    const result = await service.listAll();

    expect(result).toHaveLength(0);
  });
});

describe('StatusService.search', () => {
  const companies = [
    makeCompany('github', 'GitHub'),
    makeCompany('stripe', 'Stripe'),
    makeCompany('cloudflare', 'Cloudflare'),
  ];

  it('matches by name (case-insensitive)', async () => {
    const { service } = buildService(companies);

    const result = await service.search('git');

    expect(result).toHaveLength(1);
    expect(result[0]!.company.slug).toBe('github');
  });

  it('matches by slug', async () => {
    const { service } = buildService(companies);

    const result = await service.search('stripe');

    expect(result).toHaveLength(1);
    expect(result[0]!.company.slug).toBe('stripe');
  });

  it('returns empty array when no match', async () => {
    const { service } = buildService(companies);

    const result = await service.search('xyz-no-match');

    expect(result).toHaveLength(0);
  });

  it('trims whitespace from query', async () => {
    const { service } = buildService(companies);

    const result = await service.search('  cloud  ');

    expect(result).toHaveLength(1);
    expect(result[0]!.company.slug).toBe('cloudflare');
  });
});

describe('StatusService.getDetail', () => {
  it('returns company with current snapshot and history', async () => {
    const company = makeCompany('github', 'GitHub');
    const snapshot = makeSnapshot('github');
    const history = [makeSnapshot('github'), makeSnapshot('github')];
    const { service } = buildService([company], snapshot, history);

    const result = await service.getDetail('github');

    expect(result).not.toBeNull();
    expect(result!.company.slug).toBe('github');
    expect(result!.current).toEqual(snapshot);
    expect(result!.history).toHaveLength(2);
  });

  it('returns null when company slug does not exist', async () => {
    const { service } = buildService([makeCompany('github', 'GitHub')]);

    const result = await service.getDetail('nonexistent');

    expect(result).toBeNull();
  });

  it('returns null current snapshot when none exists for a known company', async () => {
    const { service } = buildService([makeCompany('github', 'GitHub')], null, []);

    const result = await service.getDetail('github');

    expect(result).not.toBeNull();
    expect(result!.current).toBeNull();
    expect(result!.history).toHaveLength(0);
  });
});

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CompanyRepository } from '../../../src/modules/status/repositories/CompanyRepository';
import type { Company } from '../../../src/modules/status/models/company.schema';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { StatusFetcherService } from '../../../src/modules/status/services/StatusFetcherService';

const baseCompany: Company = {
  id:            'company-1',
  name:          'GitHub',
  slug:          'github',
  logoUrl:       null,
  statusPageUrl: 'https://www.githubstatus.com',
  provider:      'statuspage',
  category:      'developer-tools',
  createdAt:     new Date(),
};

function makeRepo(companies: Company[]): CompanyRepository {
  return {
    findAll:        vi.fn().mockResolvedValue(companies),
    findAllCustom:  vi.fn().mockResolvedValue([]),
  } as unknown as CompanyRepository;
}

function makeService(repo: CompanyRepository) {
  return new StatusFetcherService(repo);
}

function okResponse(indicator: string, description: string) {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ status: { indicator, description } }),
  };
}

beforeEach(() => { mockFetch.mockReset(); });

describe('StatusFetcherService.fetchAll', () => {
  it('returns normalized status for an operational service', async () => {
    mockFetch.mockResolvedValue(okResponse('none', 'All Systems Operational'));

    const service = makeService(makeRepo([baseCompany]));
    const results = await service.fetchAll();

    expect(results).toHaveLength(1);
    expect(results[0]!.ok).toBe(true);
    expect(results[0]!.status?.indicator).toBe('none');
    expect(results[0]!.status?.description).toBe('All Systems Operational');
    expect(results[0]!.slug).toBe('github');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.githubstatus.com/api/v2/status.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('returns degraded indicator for a minor incident', async () => {
    mockFetch.mockResolvedValue(okResponse('minor', 'Minor Service Disruption'));

    const service = makeService(makeRepo([baseCompany]));
    const [result] = await service.fetchAll();

    expect(result!.ok).toBe(true);
    expect(result!.status?.indicator).toBe('minor');
  });

  it('marks result as failed when fetch throws a network error', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const service = makeService(makeRepo([baseCompany]));
    const [result] = await service.fetchAll();

    expect(result!.ok).toBe(false);
    expect(result!.error).toBe('ECONNREFUSED');
    expect(result!.companyId).toBe('company-1');
  });

  it('marks result as failed when the status page returns a non-200', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });

    const service = makeService(makeRepo([baseCompany]));
    const [result] = await service.fetchAll();

    expect(result!.ok).toBe(false);
    expect(result!.error).toBe('HTTP 503');
  });

  it('one failure does not prevent other companies from being fetched', async () => {
    const stripe: Company = { ...baseCompany, id: 'company-2', slug: 'stripe', statusPageUrl: 'https://status.stripe.com' };

    // Each company makes 2 fetch calls: status.json + components.json
    // Call 1: github status.json → fail, Call 2: github components.json → ignored
    // Call 3: stripe status.json → ok,  Call 4: stripe components.json → ok
    mockFetch
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue(okResponse('none', 'All Systems Operational'));

    const service = makeService(makeRepo([baseCompany, stripe]));
    const results = await service.fetchAll();

    expect(results).toHaveLength(2);
    expect(results[0]!.ok).toBe(false);
    expect(results[1]!.ok).toBe(true);
    expect(results[1]!.slug).toBe('stripe');
  });
});

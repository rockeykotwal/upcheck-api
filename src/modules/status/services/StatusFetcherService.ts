import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../../../tokens';
import { CompanyRepository } from '../repositories/CompanyRepository';
import type { FetchResult, StatusPageSummaryResponse } from '../types/statuspage.types';

@injectable()
export class StatusFetcherService {
  constructor(
    @inject(TOKENS.CompanyRepository) private readonly companies: CompanyRepository,
  ) {}

  async fetchAll(): Promise<FetchResult[]> {
    const [seeded, custom] = await Promise.all([
      this.companies.findAll(),
      this.companies.findAllCustom(),
    ]);

    // Deduplicate — custom monitor slugs won't overlap with seeded, but be safe
    const seededSlugs = new Set(seeded.map((c) => c.slug));
    const all = [...seeded, ...custom.filter((c) => !seededSlugs.has(c.slug))];

    const results = await Promise.allSettled(
      all.map((c) =>
        c.provider === 'http'
          ? this.fetchHttp(c.id, c.slug, c.statusPageUrl)
          : this.fetchOne(c.id, c.slug, c.statusPageUrl),
      ),
    );

    return results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return {
        companyId: all[i]!.id,
        slug:      all[i]!.slug,
        ok:        false,
        error:     r.reason instanceof Error ? r.reason.message : String(r.reason),
      };
    });
  }

  private async fetchHttp(companyId: string, slug: string, url: string): Promise<FetchResult> {
    try {
      const signal = AbortSignal.timeout(8000);
      const res = await fetch(url, { signal, method: 'GET' });

      let indicator: FetchResult['status'] extends undefined ? never : NonNullable<FetchResult['status']>['indicator'];
      let description: string;

      if (res.status >= 200 && res.status < 300) {
        indicator   = 'none';
        description = 'Operational';
      } else if (res.status >= 500) {
        indicator   = 'major';
        description = `Server error (HTTP ${res.status})`;
      } else {
        indicator   = 'minor';
        description = `Unexpected response (HTTP ${res.status})`;
      }

      return {
        companyId, slug, ok: true,
        status: { companyId, slug, indicator, description, components: [], fetchedAt: new Date() },
      };
    } catch (err) {
      const isTmeout = err instanceof Error && err.name === 'TimeoutError';
      return {
        companyId, slug, ok: true,
        status: {
          companyId, slug,
          indicator:   'critical',
          description: isTmeout ? 'Service unreachable (timeout)' : 'Service unreachable',
          components:  [],
          fetchedAt:   new Date(),
        },
      };
    }
  }

  private async fetchOne(companyId: string, slug: string, statusPageUrl: string): Promise<FetchResult> {
    const signal = AbortSignal.timeout(8000);

    const [statusRes, componentsRes] = await Promise.all([
      fetch(`${statusPageUrl}/api/v2/status.json`,     { signal }),
      fetch(`${statusPageUrl}/api/v2/components.json`, { signal }),
    ]);

    if (!statusRes.ok) {
      return { companyId, slug, ok: false, error: `HTTP ${statusRes.status}` };
    }

    const body       = await statusRes.json() as StatusPageSummaryResponse;
    const compBody   = componentsRes.ok
      ? await componentsRes.json() as { components: StatusPageSummaryResponse['components'] }
      : { components: [] };

    const components = (compBody.components ?? [])
      .filter((c) => !c.id.startsWith('group'))
      .map(({ id, name, status }) => ({ id, name, status }));

    return {
      companyId,
      slug,
      ok: true,
      status: {
        companyId,
        slug,
        indicator:   body.status.indicator,
        description: body.status.description,
        components,
        fetchedAt:   new Date(),
      },
    };
  }
}

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
    const companies = await this.companies.findAll();

    const results = await Promise.allSettled(
      companies.map((c) => this.fetchOne(c.id, c.slug, c.statusPageUrl)),
    );

    return results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return {
        companyId: companies[i]!.id,
        slug:      companies[i]!.slug,
        ok:        false,
        error:     r.reason instanceof Error ? r.reason.message : String(r.reason),
      };
    });
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

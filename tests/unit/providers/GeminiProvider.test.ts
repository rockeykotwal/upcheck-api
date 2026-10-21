import 'reflect-metadata';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GeminiProvider } from '../../../src/modules/ai/providers/GeminiProvider';

afterEach(() => {
  vi.restoreAllMocks();
});

const successBody = {
  candidates: [{ content: { parts: [{ text: '  Looks fine.  ' }] } }],
};

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

describe('GeminiProvider.complete', () => {
  it('returns trimmed text from first candidate', async () => {
    mockFetch(successBody);
    const provider = new GeminiProvider();

    const result = await provider.complete('Summarize.');

    expect(result).toBe('Looks fine.');
  });

  it('throws 502 when Gemini returns non-ok status', async () => {
    mockFetch({}, false, 429);
    const provider = new GeminiProvider();

    await expect(provider.complete('prompt')).rejects.toMatchObject({ statusCode: 502 });
  });

  it('throws 503 on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
    const provider = new GeminiProvider();

    await expect(provider.complete('prompt')).rejects.toMatchObject({ statusCode: 503 });
  });
});

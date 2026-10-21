import 'reflect-metadata';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { OpenAiProvider } from '../../../src/modules/ai/providers/OpenAiProvider';

afterEach(() => {
  vi.restoreAllMocks();
});

const successBody = {
  choices: [{ message: { content: '  Service disruption detected.  ' } }],
};

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

describe('OpenAiProvider.complete', () => {
  it('returns trimmed content from first choice', async () => {
    mockFetch(successBody);
    const provider = new OpenAiProvider();

    const result = await provider.complete('Summarize.');

    expect(result).toBe('Service disruption detected.');
  });

  it('throws 502 when OpenAI returns non-ok status', async () => {
    mockFetch({}, false, 401);
    const provider = new OpenAiProvider();

    await expect(provider.complete('prompt')).rejects.toMatchObject({ statusCode: 502 });
  });

  it('throws 503 on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
    const provider = new OpenAiProvider();

    await expect(provider.complete('prompt')).rejects.toMatchObject({ statusCode: 503 });
  });

  it('sends Authorization header with Bearer token', async () => {
    const spy = mockFetch(successBody);
    const provider = new OpenAiProvider();

    await provider.complete('prompt');

    const headers = spy.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^Bearer /);
  });
});

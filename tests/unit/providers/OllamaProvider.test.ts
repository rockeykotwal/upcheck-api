import 'reflect-metadata';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { OllamaProvider } from '../../../src/modules/ai/providers/OllamaProvider';

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

describe('OllamaProvider.complete', () => {
  it('returns trimmed response on success', async () => {
    mockFetch({ response: '  All good.  ' });
    const provider = new OllamaProvider();

    const result = await provider.complete('Summarize this.');

    expect(result).toBe('All good.');
  });

  it('throws 502 when Ollama returns non-ok status', async () => {
    mockFetch({}, false, 500);
    const provider = new OllamaProvider();

    await expect(provider.complete('prompt')).rejects.toMatchObject({ statusCode: 502 });
  });

  it('throws 503 when fetch itself throws (network error)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    const provider = new OllamaProvider();

    await expect(provider.complete('prompt')).rejects.toMatchObject({ statusCode: 503 });
  });

  it('sends correct request body', async () => {
    const spy = mockFetch({ response: 'ok' });
    const provider = new OllamaProvider();

    await provider.complete('my prompt');

    const body = JSON.parse(spy.mock.calls[0]![1]!.body as string) as Record<string, unknown>;
    expect(body.prompt).toBe('my prompt');
    expect(body.stream).toBe(false);
  });
});

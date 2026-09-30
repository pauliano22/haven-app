import { RemoteLlmClient } from './RemoteLlmClient';

describe('RemoteLlmClient', () => {
  const RELAY_URL = 'https://relay.example/summarize';

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('POSTs the prompt and returns the relay text', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'A faithful summary.' }),
    });

    const client = new RemoteLlmClient({ relayUrl: RELAY_URL });
    const text = await client.complete('summarize these facts');

    expect(text).toBe('A faithful summary.');
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(RELAY_URL);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ prompt: 'summarize these facts' });
  });

  it('sends the shared-secret header only when one is configured', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ text: 'ok' }) });

    await new RemoteLlmClient({ relayUrl: RELAY_URL, sharedSecret: 'shh' }).complete('x');
    let headers = (global.fetch as jest.Mock).mock.calls[0][1].headers;
    expect(headers['x-relay-secret']).toBe('shh');

    (global.fetch as jest.Mock).mockClear();
    await new RemoteLlmClient({ relayUrl: RELAY_URL }).complete('x');
    headers = (global.fetch as jest.Mock).mock.calls[0][1].headers;
    expect(headers['x-relay-secret']).toBeUndefined();
  });

  it('throws (which the caller falls back on) when the relay responds with an error status', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });

    const client = new RemoteLlmClient({ relayUrl: RELAY_URL });
    await expect(client.complete('x')).rejects.toThrow('502');
  });

  it('returns empty string if the relay response has no text field', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    const client = new RemoteLlmClient({ relayUrl: RELAY_URL });
    expect(await client.complete('x')).toBe('');
  });
});

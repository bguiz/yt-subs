import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mcpHeaders, sseToJson } from './yt-subs-docs-openapi.js';

describe('mcpHeaders', () => {
  it('always includes Content-Type and Accept', () => {
    const h = mcpHeaders(null);
    assert.equal(h['Content-Type'], 'application/json');
    assert.equal(h.Accept, 'application/json, text/event-stream');
  });

  it('uses custom contentType when provided', () => {
    const h = mcpHeaders(null, 'application/x-custom');
    assert.equal(h['Content-Type'], 'application/x-custom');
  });

  it('omits mcp-session-id when sessionId is null', () => {
    const h = mcpHeaders(null);
    assert.ok(!Object.hasOwn(h, 'mcp-session-id'), 'should not include mcp-session-id');
  });

  it('omits mcp-session-id when sessionId is undefined', () => {
    const h = mcpHeaders(undefined);
    assert.ok(!Object.hasOwn(h, 'mcp-session-id'), 'should not include mcp-session-id');
  });

  it('omits mcp-session-id when sessionId is empty string', () => {
    const h = mcpHeaders('');
    assert.ok(!Object.hasOwn(h, 'mcp-session-id'), 'should not include mcp-session-id');
  });

  it('includes mcp-session-id when sessionId is a non-empty string', () => {
    const h = mcpHeaders('abc-123');
    assert.equal(h['mcp-session-id'], 'abc-123');
  });
});

function fakeRes(text) {
  return { text: async () => text };
}

describe('sseToJson', () => {
  it('extracts the data payload from a single SSE event', async () => {
    const payload = await sseToJson(fakeRes('data: {"jsonrpc":"2.0","result":{}}\n\n'));
    assert.equal(payload, '{"jsonrpc":"2.0","result":{}}');
  });

  it('returns the LAST data line when there are multiple events', async () => {
    const sse = 'data: {"partial":true}\n\ndata: {"jsonrpc":"2.0","result":{"tools":[]}}\n\n';
    const payload = await sseToJson(fakeRes(sse));
    assert.equal(payload, '{"jsonrpc":"2.0","result":{"tools":[]}}');
  });

  it('returns "{}" when there are no data lines', async () => {
    const sse = 'event: ping\n: heartbeat comment\n\n';
    const payload = await sseToJson(fakeRes(sse));
    assert.equal(payload, '{}');
  });

  it('ignores non-data SSE fields (event:, id:, :) alongside data lines', async () => {
    const sse = 'event: message\nid: 1\ndata: {"jsonrpc":"2.0"}\n\n';
    const payload = await sseToJson(fakeRes(sse));
    assert.equal(payload, '{"jsonrpc":"2.0"}');
  });

  it('strips only the "data: " prefix, preserving the rest of the line verbatim', async () => {
    const payload = await sseToJson(fakeRes('data: hello world\n'));
    assert.equal(payload, 'hello world');
  });

  it('returns "{}" for an empty SSE body', async () => {
    const payload = await sseToJson(fakeRes(''));
    assert.equal(payload, '{}');
  });
});

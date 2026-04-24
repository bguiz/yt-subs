import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import ytSubSdk, { extractFromVideo, outputTextOnly, outputAsMarkdown } from './yt-subs-sdk.js';

describe('ytSubSdk default export', () => {
  it('exposes extractFromVideo, outputTextOnly, and outputAsMarkdown', () => {
    assert.strictEqual(typeof ytSubSdk.extractFromVideo, 'function');
    assert.strictEqual(typeof ytSubSdk.outputTextOnly, 'function');
    assert.strictEqual(typeof ytSubSdk.outputAsMarkdown, 'function');
  });

  it('extractFromVideo is the same function as the named extractFromVideo export', () => {
    assert.strictEqual(ytSubSdk.extractFromVideo, extractFromVideo);
  });

  it('outputTextOnly is the same function as the named outputTextOnly export', () => {
    assert.strictEqual(ytSubSdk.outputTextOnly, outputTextOnly);
  });

  it('outputAsMarkdown is the same function as the named outputAsMarkdown export', () => {
    assert.strictEqual(ytSubSdk.outputAsMarkdown, outputAsMarkdown);
  });
});

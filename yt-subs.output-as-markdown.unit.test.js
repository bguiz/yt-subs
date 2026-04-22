import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import ytSubSdk from './yt-subs-sdk.js';

describe('outputAsMarkdown', () => {
  const result = {
    title: 'Never Gonna Give You Up',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    metadata: { videoId: 'dQw4w9WgXcQ', author: 'RickAstleyVEVO' },
    description: 'Official music video',
    text: 'Never gonna give you up, never gonna let you down',
  };

  it('returns a string starting with the title heading', () => {
    const out = ytSubSdk.outputAsMarkdown(result);
    assert.ok(out.startsWith(`# ${result.title}\n`));
  });

  it('includes a retrieval line with the video URL and an ISO timestamp', () => {
    const out = ytSubSdk.outputAsMarkdown(result);
    assert.match(
      out,
      /> Retrieved from https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ on \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z via ytsubs/,
    );
  });

  it('includes metadata as JSON', () => {
    const out = ytSubSdk.outputAsMarkdown(result);
    assert.ok(out.includes('\n\n## Metadata\n'));
    assert.ok(out.includes(JSON.stringify(result.metadata)));
  });

  it('includes description and text sections', () => {
    const out = ytSubSdk.outputAsMarkdown(result);
    assert.ok(out.includes('\n\n## Description\n'));
    assert.ok(out.includes(result.description));
    assert.ok(out.includes('\n\n## Text\n'));
    assert.ok(out.endsWith(result.text));
  });

  it('omits thumbnail image when metadata.thumbnails is absent', () => {
    const out = ytSubSdk.outputAsMarkdown(result);
    assert.ok(!out.includes('!['));
  });

  it('omits thumbnail image when all thumbnails have width < 480', () => {
    const resultWithSmallThumbnails = {
      ...result,
      metadata: {
        ...result.metadata,
        thumbnails: [
          { url: 'https://example.com/thumb120.jpg', width: 120, height: 90 },
          { url: 'https://example.com/thumb320.jpg', width: 320, height: 180 },
        ],
      },
    };
    const out = ytSubSdk.outputAsMarkdown(resultWithSmallThumbnails);
    assert.ok(!out.includes('!['));
  });

  it('inserts thumbnail image after h1 when a thumbnail with width >= 480 exists', () => {
    const thumbnailUrl = 'https://example.com/thumb480.jpg';
    const resultWithLargeThumbnail = {
      ...result,
      metadata: {
        ...result.metadata,
        thumbnails: [
          { url: 'https://example.com/thumb120.jpg', width: 120, height: 90 },
          { url: thumbnailUrl, width: 480, height: 360 },
        ],
      },
    };
    const out = ytSubSdk.outputAsMarkdown(resultWithLargeThumbnail);
    assert.ok(out.includes(`\n![${result.title}](${thumbnailUrl})\n`));
    // thumbnail must appear between the h1 and the retrieval line
    const h1End = out.indexOf('\n', 0) + 1;
    const thumbnailPos = out.indexOf(`![${result.title}]`);
    const retrievalPos = out.indexOf('> Retrieved from');
    assert.ok(thumbnailPos >= h1End, 'thumbnail should appear after h1');
    assert.ok(thumbnailPos < retrievalPos, 'thumbnail should appear before retrieval line');
  });
});

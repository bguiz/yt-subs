#!/usr/bin/env node

import { realpathSync as fsRealPathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { extractFromVideo, printResult } from './yt-subs-sdk.js';

/**
 * Extracts the transcript for a Youtube video and prints it to stdout as markdown.
 * When invoked as a script, reads the video URL from `process.argv[2]`.
 * When called programmatically, `input` takes precedence.
 * @param {string} [input] - YouTube URL or bare video ID. Falls back to `process.argv[2]`.
 * @returns {Promise<{videoUrl: string, title: string, description: string, metadata: object, text: string}>}
 *   The extraction result.
 * @throws {Error} If the URL is invalid or the transcript cannot be retrieved.
 */
async function ytSubsCli(input) {
  const videoUrl = input || process.argv[2];
  const result = await extractFromVideo({
    videoUrl,
  });
  if (result.err) {
    throw new Error(result.err);
  }
  printResult({
    videoUrl,
    ...result,
  });
  return result;
}

const filePath = fileURLToPath(import.meta.url);
if (fsRealPathSync(process.argv[1]) === filePath) {
  ytSubsCli().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

export default ytSubsCli;

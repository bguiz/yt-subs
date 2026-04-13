#!/usr/bin/env node

import { realpathSync as fsRealPathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    youtubeScript,
    printResult,
} from './yt-subs-sdk.js';

async function ytSubsCli(input) {
    const videoUrl = input || process.argv[2];
    const result = await youtubeScript({
        videoUrl,
    });
    if (result.err) {
        console.error(result.err);
        process.exit(2);
    };
    printResult({
        videoUrl,
        ...result,
    });
    process.exit(0);
}

const filePath = fileURLToPath(import.meta.url);
if (fsRealPathSync(process.argv[1]) === filePath) {
    ytSubsCli();
}

export default ytSubsCli;

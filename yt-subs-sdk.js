import { homedir as osHomeDir } from 'node:os';
import { resolve as pathResolve } from 'node:path';

import {
    fetchTranscript,
    toPlainText,
    toSRT,
    toVTT,
    FsCache,
    YoutubeTranscriptVideoUnavailableError,
    YoutubeTranscriptDisabledError,
    YoutubeTranscriptNotAvailableError,
    YoutubeTranscriptNotAvailableLanguageError,
    YoutubeTranscriptInvalidLangError,
} from 'youtube-transcript-plus';

async function extractFromVideo({
    videoUrl,
    options = {},
    _deps = {},
}) {
    const {
        fetchTranscript: _fetchTranscript = fetchTranscript,
        toPlainText: _toPlainText = toPlainText,
        toSRT: _toSRT = toSRT,
        toVTT: _toVTT = toVTT,
        FsCache: _FsCache = FsCache,
    } = _deps;

    let videoId;
    try {
        videoId = extractVideoId(videoUrl);
    } catch (error) {
        return { err: error.message };
    }

    let ytScriptFsCache;
    if (!options.noCache) {
        ytScriptFsCache = new _FsCache(
            pathResolve(osHomeDir(), '.yt-subs-cache'),
            86400e3, // 1 day
        );
    }
    let retries = 0;
    let retryDelay = 0;
    if (!options.noRetry) {
        retries = 5;
        retryDelay = 500;
    }

    let rawResult;
    let err;
    try {
        rawResult = await _fetchTranscript(
            videoId,
            {
                lang: (options.language || 'en'),
                cache: ytScriptFsCache,
                videoDetails: true,
                retries,
                retryDelay,
            },
        );
    } catch (error) {
        if (error instanceof YoutubeTranscriptVideoUnavailableError) {
            err = `Video is unavailable: ${error.videoId}`;
        } else if (error instanceof YoutubeTranscriptDisabledError) {
            err = `Transcripts are disabled: ${error.videoId}`;
        } else if (error instanceof YoutubeTranscriptNotAvailableError) {
            err = `No transcript available: ${error.videoId}`;
        } else if (error instanceof YoutubeTranscriptNotAvailableLanguageError) {
            err = `Language not available: ${error.lang}, available: ${error.availableLangs}`;
        } else if (error instanceof YoutubeTranscriptInvalidLangError) {
            err = `Invalid language code: ${error.lang}`;
        } else {
            err = `An unexpected error occurred: ${error.message}`;
        }
    }
    if (err) {
        return { err };
    }

    const { title, description, ...metadata } = rawResult.videoDetails;

    let textTranscript;
    switch (options.textType) {
        case 'srt':
            textTranscript = _toSRT(rawResult.segments);
            break;
        case 'vtt':
            textTranscript = _toVTT(rawResult.segments);
            break;
        default:
            textTranscript = _toPlainText(rawResult.segments);
    }
    return {
        videoUrl,
        title,
        metadata,
        description,
        text: textTranscript,
    };
}

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

function extractVideoId(videoUrl) {
    if (!videoUrl || typeof videoUrl !== 'string') {
        throw new Error('video URL is missing');
    }

    // Try parsing as URL, then with https:// prefix for schemeless inputs (e.g. youtu.be/...)
    let parsed;
    for (const candidate of [videoUrl, `https://${videoUrl}`]) {
        try {
            parsed = new URL(candidate);
            break;
        } catch {
            // continue to next candidate
        }
    }

    if (parsed) {
        const { hostname, pathname, searchParams } = parsed;
        if (hostname.endsWith('youtube.com')) {
            const v = searchParams.get('v');
            if (v && VIDEO_ID_RE.test(v)) {
                return v;
            }
        } else if (hostname === 'youtu.be') {
            const id = pathname.slice(1);
            if (VIDEO_ID_RE.test(id)) {
                return id;
            }
        }
    }

    // Fallback: bare 11-character video ID with valid characters
    if (VIDEO_ID_RE.test(videoUrl)) {
        return videoUrl;
    }

    throw new Error(`video URL is invalid: ${videoUrl}`);
}

function outputTextOnly(result) {
    return result.text;
}

function outputAsMarkdown(result) {
    const displayDate = (new Date()).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const thumbnailUrl = result.metadata?.thumbnails
        ?.filter((tn) => (tn.width >= 480))[0]
        ?.url;
    const parts = [
        `# ${result.title}\n`,
    ];
    if (thumbnailUrl) {
        parts.push(`\n![${result.title}](${thumbnailUrl})\n`);
    }
    parts.push(
        `\n> Retrieved from ${result.videoUrl} on ${displayDate} via ytsubs`,
        '\n\n## Metadata\n',
        JSON.stringify(result.metadata),
        '\n\n## Description\n',
        result.description,
        '\n\n## Text\n',
        result.text,
    );
    return parts.join('');
}

function printResult(result) {
    console.log(outputAsMarkdown(result));
}

const ytSubSdk = {
    extractFromVideo,
    outputTextOnly,
    outputAsMarkdown,
};

export default ytSubSdk;

export {
    extractFromVideo,
    outputTextOnly,
    outputAsMarkdown,
    extractVideoId,
    printResult,
};

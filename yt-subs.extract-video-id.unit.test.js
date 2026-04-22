import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extractVideoId } from './yt-subs-sdk.js';

describe('extractVideoId', () => {
    describe('valid inputs', () => {
        it('extracts ID from youtube.com watch URL', () => {
            assert.strictEqual(
                extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
                'dQw4w9WgXcQ',
            );
        });

        it('extracts ID from youtube.com watch URL with extra params', () => {
            assert.strictEqual(
                extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s'),
                'dQw4w9WgXcQ',
            );
        });

        it('extracts ID from youtube.com watch URL with extra params and anchor', () => {
            assert.strictEqual(
                extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxxx&index=1#comments'),
                'dQw4w9WgXcQ',
            );
        });

        it('extracts ID from m.youtube.com (mobile) URL with extra params and anchor', () => {
            assert.strictEqual(
                extractVideoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ&pp=ajebQw%3D%3D#something'),
                'dQw4w9WgXcQ',
            );
        });

        it('extracts ID from youtu.be short URL', () => {
            assert.strictEqual(
                extractVideoId('https://youtu.be/dQw4w9WgXcQ'),
                'dQw4w9WgXcQ',
            );
        });

        it('extracts ID from youtu.be short URL with extra params and anchor', () => {
            assert.strictEqual(
                extractVideoId('https://youtu.be/dQw4w9WgXcQ?si=sometoken&t=42#comments'),
                'dQw4w9WgXcQ',
            );
        });

        it('returns a bare 11-character video ID as-is', () => {
            assert.strictEqual(
                extractVideoId('dQw4w9WgXcQ'),
                'dQw4w9WgXcQ',
            );
        });

        it('extracts ID from schemeless youtu.be short URL', () => {
            assert.strictEqual(
                extractVideoId('youtu.be/dQw4w9WgXcQ'),
                'dQw4w9WgXcQ',
            );
        });

        it('extracts ID from schemeless m.youtube.com URL', () => {
            assert.strictEqual(
                extractVideoId('m.youtube.com/watch?v=dQw4w9WgXcQ'),
                'dQw4w9WgXcQ',
            );
        });
    });

    describe('invalid inputs', () => {
        it('throws for missing videoUrl', () => {
            assert.throws(
                () => extractVideoId(undefined),
                { message: 'video URL is missing' },
            );
        });

        it('throws for non-string videoUrl', () => {
            assert.throws(
                () => extractVideoId(42),
                { message: 'video URL is missing' },
            );
        });

        it('throws for a URL with no recognisable video ID', () => {
            assert.throws(
                () => extractVideoId('https://www.youtube.com/watch?list=PLxxx'),
                { message: 'video URL is invalid: https://www.youtube.com/watch?list=PLxxx' },
            );
        });

        it('throws for a string that is not 11 characters and not a YouTube URL', () => {
            assert.throws(
                () => extractVideoId('tooshort'),
                { message: 'video URL is invalid: tooshort' },
            );
        });

        it('throws for an 11-character string containing invalid characters', () => {
            assert.throws(
                () => extractVideoId('hello world'),
                { message: 'video URL is invalid: hello world' },
            );
        });

        it('throws for a URL from m.youtube.com (mobile) URL with invalid v query param', () => {
            const invalidUrl = 'https://m.youtube.com/watch?v=123dQw4w9WgXcQ&pp=ajebQw%3D%3D#something';
            assert.throws(
                () => extractVideoId(invalidUrl),
                { message: `video URL is invalid: ${invalidUrl}` },
            );
        });

        it('throws for a URL from youtu.be (mobile) URL with invalid path', () => {
            const invalidUrl = 'https://youtu.be/123dQw4w9WgXcQ';
            assert.throws(
                () => extractVideoId(invalidUrl),
                { message: `video URL is invalid: ${invalidUrl}` },
            );
        });
    });
});

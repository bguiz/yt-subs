import assert from 'node:assert/strict';
import { execSync, spawn } from 'node:child_process';
import { describe, it, before, after } from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const IMAGE_NAME = 'ytsubs-test';
const HOST_PORT = 13456;
const VIDEO_URL = 'https://www.youtube.com/watch?v=wd9WJ8uazVg&list=PLjyCRcs63y81JbTc8bqzkcgRWzA7_H23B&index=1';
const VIDEO_ID = 'wd9WJ8uazVg';

describe('ytsubs-server e2e (Docker)', { timeout: 120_000 }, () => {
  let client;
  let containerName;

  before(async () => {
    // Build image from the local Dockerfile
    execSync(`docker build -t ${IMAGE_NAME} .`, { stdio: 'inherit' });

    containerName = `ytsubs-test-${Date.now()}`;
    const containerProcess = spawn(
      'docker',
      ['run', '--rm', '--name', containerName, '-p', `${HOST_PORT}:3456`, IMAGE_NAME],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );

    // Wait for the container to be ready by polling the /health endpoint
    await new Promise((resolve, reject) => {
      const deadline = Date.now() + 30_000;
      containerProcess.on('error', reject);
      containerProcess.on('close', (code) => {
        reject(new Error(`container exited (code ${code}) before becoming ready`));
      });

      function poll() {
        if (Date.now() > deadline) {
          reject(new Error('timed out waiting for Docker container to become ready'));
          return;
        }
        // Any HTTP response (even 406) means the server is up and ready.
        fetch(`http://127.0.0.1:${HOST_PORT}/mcp`, { method: 'POST' })
          .then(() => resolve(containerProcess))
          .catch(() => setTimeout(poll, 500));
      }
      setTimeout(poll, 1000);
    });

    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${HOST_PORT}/mcp`));
    client = new Client({ name: 'docker-test-client', version: '0.0.1' });
    await client.connect(transport);
  });

  after(async () => {
    try {
      await client?.close();
    } catch {
      // ignore cleanup errors
    }
    if (containerName) {
      try {
        execSync(`docker stop ${containerName}`, { stdio: 'ignore' });
      } catch {
        // ignore if already stopped
      }
    }
  });

  it('GET /health returns 200 with status ok', async () => {
    const res = await fetch(`http://127.0.0.1:${HOST_PORT}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.equal(typeof data.version, 'string');
  });

  it('lists the youtube-transcript-extract tool with correct metadata', async () => {
    const { tools } = await client.listTools();

    const tool = tools.find((t) => t.name === 'youtube-transcript-extract');
    assert.ok(tool, 'youtube-transcript-extract tool not registered');
    assert.match(tool.description, /transcript/i);
    assert.ok(tool.inputSchema, 'tool should have an inputSchema');
  });

  it('returns plain transcript text with onlyText: true', { timeout: 60_000 }, async () => {
    const response = await client.callTool({
      name: 'youtube-transcript-extract',
      arguments: { videoUrl: VIDEO_URL, onlyText: true },
    });

    assert.ok(!response.isError, `unexpected error: ${JSON.stringify(response.content)}`);
    assert.strictEqual(response.content.length, 1);
    assert.strictEqual(response.content[0].type, 'text');
    assert.ok(response.content[0].text.length > 0, 'transcript text should be non-empty');
  });

  it('returns full result as JSON with onlyText: false', { timeout: 60_000 }, async () => {
    const response = await client.callTool({
      name: 'youtube-transcript-extract',
      arguments: { videoUrl: VIDEO_URL, onlyText: false },
    });

    assert.ok(!response.isError, `unexpected error: ${JSON.stringify(response.content)}`);
    assert.strictEqual(response.content.length, 1);
    assert.strictEqual(response.content[0].type, 'text');

    const data = JSON.parse(response.content[0].text);
    assert.equal(typeof data.title, 'string');
    assert.ok(data.title.length > 0, 'title should be non-empty');
    assert.equal(typeof data.text, 'string');
    assert.ok(data.text.length > 0, 'transcript should be non-empty');
    assert.equal(typeof data.description, 'string');
    assert.equal(typeof data.metadata, 'object');
    assert.equal(data.metadata.videoId, VIDEO_ID);
  });
});

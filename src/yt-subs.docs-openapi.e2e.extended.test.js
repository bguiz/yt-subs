import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { describe, it, before, after } from 'node:test';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('serve-openapi e2e', () => {
  let baseUrl;
  let docsProcess;
  let mcpProcess;

  before(
    async () => {
      // Start combined HTTP server on an ephemeral port
      mcpProcess = spawn('node', [join(__dirname, 'yt-subs-server.js')], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });

      const mcpPort = await new Promise((resolve, reject) => {
        let stderr = '';
        mcpProcess.stderr.on('data', (chunk) => {
          stderr += chunk.toString();
          const match = stderr.match(/LISTEN (\d+)/);
          if (match) resolve(parseInt(match[1], 10));
        });
        mcpProcess.on('error', reject);
        mcpProcess.on('close', (code) => {
          reject(new Error(`MCP server exited (code ${code}) before announcing port`));
        });
      });

      // Start docs server pointing at the MCP server's port
      docsProcess = spawn('node', [join(__dirname, 'yt-subs-docs-openapi.js')], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, YTSUBS_DOCS_PORT: '0', YTSUBS_PORT: String(mcpPort) },
      });

      const docsPort = await new Promise((resolve, reject) => {
        let stdout = '';
        docsProcess.stdout.on('data', (chunk) => {
          stdout += chunk.toString();
          const match = stdout.match(/http:\/\/127\.0\.0\.1:(\d+)\//);
          if (match) resolve(parseInt(match[1], 10));
        });
        docsProcess.on('error', reject);
        docsProcess.on('close', (code) => {
          reject(new Error(`docs server exited (code ${code}) before announcing port`));
        });
      });

      baseUrl = `http://127.0.0.1:${docsPort}`;
    },
    { timeout: 30_000 },
  );

  after(() => {
    for (const proc of [docsProcess, mcpProcess]) {
      if (proc && !proc.killed) {
        try {
          proc.kill('SIGTERM');
        } catch {
          // ignore
        }
      }
    }
  });

  it('GET / returns HTML with Swagger UI initialisation', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    const html = await res.text();
    assert.ok(html.includes('swagger-ui-bundle.js'), 'HTML should load swagger-ui-bundle.js');
    assert.ok(html.includes('/openapi.yaml'), 'HTML should reference /openapi.yaml');
    assert.ok(html.includes('SwaggerUIBundle'), 'HTML should initialise SwaggerUIBundle');
  });

  it('GET /openapi.yaml returns YAML OpenAPI 3.1.0 spec', async () => {
    const res = await fetch(`${baseUrl}/openapi.yaml`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/yaml/);
    const text = await res.text();
    assert.match(text, /^openapi:/, 'content should start with openapi:');
    assert.ok(text.includes('/mcp'), 'spec should reference /mcp path');
    assert.ok(text.includes('/transcript'), 'spec should reference /transcript path');
  });

  it('GET /swagger-ui-bundle.js returns JavaScript bundle', async () => {
    const res = await fetch(`${baseUrl}/swagger-ui-bundle.js`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /javascript/);
    const text = await res.text();
    assert.ok(text.length > 10_000, 'Swagger UI bundle should be non-trivially large');
  });

  it('GET /swagger-ui.css returns CSS', async () => {
    const res = await fetch(`${baseUrl}/swagger-ui.css`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /css/);
  });

  it('POST /mcp proxies tools/list to the MCP server and returns JSON', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    const data = JSON.parse(await res.text());
    assert.equal(data.jsonrpc, '2.0');
    assert.ok(Array.isArray(data.result?.tools), 'result.tools should be an array');
    assert.ok(
      data.result.tools.some((t) => t.name === 'youtube-transcript-extract'),
      'youtube-transcript-extract tool should be listed',
    );
  });

  it('GET /nonexistent returns 404', async () => {
    const res = await fetch(`${baseUrl}/nonexistent`);
    assert.equal(res.status, 404);
  });

  it('POST /mcp handles multiple consecutive requests using the same session', async () => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
    const headers = { 'Content-Type': 'application/json' };

    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${baseUrl}/mcp`, { method: 'POST', headers, body });
      assert.equal(res.status, 200, `request ${i + 1} should return 200`);
      const data = JSON.parse(await res.text());
      assert.equal(data.jsonrpc, '2.0', `request ${i + 1} should have jsonrpc 2.0`);
      assert.ok(Array.isArray(data.result?.tools), `request ${i + 1}: result.tools should be an array`);
    }
  });
});

describe('serve-openapi e2e — MCP unreachable', () => {
  let baseUrl;
  let docsProcess;

  before(
    async () => {
      // Start docs server pointing at a port with no MCP server
      docsProcess = spawn('node', [join(__dirname, 'yt-subs-docs-openapi.js')], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, YTSUBS_DOCS_PORT: '0', YTSUBS_MCP_PORT: '1' },
      });

      const docsPort = await new Promise((resolve, reject) => {
        let stdout = '';
        docsProcess.stdout.on('data', (chunk) => {
          stdout += chunk.toString();
          const match = stdout.match(/http:\/\/127\.0\.0\.1:(\d+)\//);
          if (match) resolve(parseInt(match[1], 10));
        });
        docsProcess.on('error', reject);
        docsProcess.on('close', (code) => {
          reject(new Error(`docs server exited (code ${code}) before announcing port`));
        });
      });

      baseUrl = `http://127.0.0.1:${docsPort}`;
    },
    { timeout: 15_000 },
  );

  after(() => {
    if (docsProcess && !docsProcess.killed) {
      try {
        docsProcess.kill('SIGTERM');
      } catch {
        // ignore
      }
    }
  });

  it('POST /mcp returns 502 when MCP server is unreachable', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });
    assert.equal(res.status, 502);
    const text = await res.text();
    assert.ok(text.length > 0, 'response body should describe the error');
  });
});

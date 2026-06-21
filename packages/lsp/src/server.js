#!/usr/bin/env node
// SynapseIQ Language Server — HTTP gateway
// Provides diagnostics, symbols, hover, and completions via a lightweight HTTP API.
// No build step — plain Node.js using only stdlib.

'use strict';

const http = require('node:http');
const { spawnSync } = require('node:child_process');

const PORT = parseInt(process.env.SYNAPSEIQ_LSP_PORT || '2087', 10);
const VERSION = '0.1.0';

const SUPPORTED_LANGUAGES = [
  'python', 'typescript', 'javascript', 'lua', 'rust', 'go',
  'shell', 'json', 'yaml', 'ruby', 'java', 'cpp', 'c',
];

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

function detectLanguage(filename) {
  if (!filename) return 'unknown';
  const ext = filename.replace(/.*\./, '').toLowerCase();
  const map = {
    py: 'python',
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    lua: 'lua',
    rs: 'rust',
    go: 'go',
    sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
    json: 'json',
    yaml: 'yaml', yml: 'yaml',
    rb: 'ruby',
    java: 'java',
    cpp: 'cpp', cc: 'cpp', cxx: 'cpp', h: 'cpp', hpp: 'cpp',
    c: 'c',
  };
  return map[ext] || 'unknown';
}

// ---------------------------------------------------------------------------
// Symbol extraction
// ---------------------------------------------------------------------------

function extractSymbols(text, language) {
  const symbols = [];
  const lines = text.split('\n');

  const addMatch = (pattern, kind, opts = {}) => {
    const flags = opts.flags || 'gm';
    const re = new RegExp(pattern, flags);
    let m;
    while ((m = re.exec(text)) !== null) {
      const lineNo = text.slice(0, m.index).split('\n').length - 1;
      const col = m.index - text.lastIndexOf('\n', m.index) - 1;
      symbols.push({ name: m[1], kind, line: lineNo, col: Math.max(0, col) });
    }
  };

  switch (language) {
    case 'python':
      addMatch(/^(?:async\s+)?def\s+(\w+)\s*\(/, 'function');
      addMatch(/^class\s+(\w+)[\s:(]/, 'class');
      addMatch(/^(\w+)\s*=\s*(?!lambda)/, 'variable');
      break;

    case 'typescript':
    case 'javascript':
      addMatch(/(?:^|\s)function\s+(\w+)\s*\(/, 'function');
      addMatch(/(?:^|\s)(?:async\s+)?(?:export\s+)?(?:default\s+)?function\s+(\w+)/, 'function');
      addMatch(/(?:^|\s)class\s+(\w+)[\s{]/, 'class');
      addMatch(/(?:^|\s)interface\s+(\w+)[\s{]/, 'interface');
      addMatch(/(?:^|\s)type\s+(\w+)\s*=/, 'type');
      addMatch(/(?:^|\s)(?:const|let|var)\s+(\w+)\s*=/, 'variable');
      addMatch(/(?:^|\s)(?:export\s+)?(?:const|let)\s+(\w+)\s*[:=]/, 'variable');
      break;

    case 'lua':
      addMatch(/^function\s+([\w.:]+)\s*\(/, 'function');
      addMatch(/^local\s+function\s+(\w+)\s*\(/, 'function');
      addMatch(/^(?:local\s+)?(\w+)\s*=\s*function\s*\(/, 'function');
      addMatch(/^(\w+)\.\w+\s*=\s*function\s*\(/, 'variable');
      break;

    case 'rust':
      addMatch(/(?:^|\s)(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*[<(]/, 'function');
      addMatch(/(?:^|\s)(?:pub\s+)?struct\s+(\w+)[\s<{]/, 'struct');
      addMatch(/(?:^|\s)(?:pub\s+)?enum\s+(\w+)[\s<{]/, 'enum');
      addMatch(/(?:^|\s)(?:pub\s+)?trait\s+(\w+)[\s<{]/, 'interface');
      addMatch(/(?:^|\s)impl(?:\s+\w+\s+for)?\s+(\w+)[\s<{]/, 'class');
      addMatch(/(?:^|\s)(?:pub\s+)?(?:const|static)\s+(\w+)\s*:/, 'variable');
      break;

    case 'go':
      addMatch(/^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/, 'function');
      addMatch(/^type\s+(\w+)\s+(?:struct|interface)\s*{/, 'class');
      addMatch(/^var\s+(\w+)\s/, 'variable');
      addMatch(/^const\s+(\w+)\s/, 'variable');
      break;

    case 'shell':
      addMatch(/^(\w+)\s*\(\s*\)/, 'function');
      addMatch(/^function\s+(\w+)/, 'function');
      break;

    default:
      break;
  }

  // Deduplicate by name+line
  const seen = new Set();
  return symbols.filter(s => {
    const key = `${s.name}:${s.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Diagnostic extraction
// ---------------------------------------------------------------------------

function extractDiagnostics(text, language, filename) {
  const diags = [];
  const ts = new Date().toISOString();

  if (language === 'python') {
    // Run python3 syntax check via stdin
    const res = spawnSync('python3', ['-c', `
import ast, json, sys
src = sys.stdin.read()
try:
    ast.parse(src)
    print(json.dumps([]))
except SyntaxError as e:
    print(json.dumps([{"line": (e.lineno or 1) - 1, "col": e.offset or 0, "message": str(e.msg), "severity": "error"}]))
`], {
      input: text,
      encoding: 'utf8',
      timeout: 5000,
    });
    if (res.stdout) {
      try {
        const parsed = JSON.parse(res.stdout.trim());
        for (const d of parsed) {
          diags.push({ line: d.line, col: d.col, end_line: d.line, end_col: d.col + 1, severity: 'error', message: d.message, source: 'synapseiq-lsp/python-ast' });
        }
      } catch (_) { /* ignore */ }
    }
    return diags;
  }

  if (language === 'json') {
    try {
      JSON.parse(text);
    } catch (err) {
      const m = err.message.match(/position (\d+)/);
      let line = 0, col = 0;
      if (m) {
        const pos = parseInt(m[1], 10);
        const before = text.slice(0, pos);
        line = before.split('\n').length - 1;
        col = pos - before.lastIndexOf('\n') - 1;
      }
      diags.push({ line, col, end_line: line, end_col: col + 1, severity: 'error', message: err.message, source: 'synapseiq-lsp/json' });
    }
    return diags;
  }

  if (language === 'yaml') {
    const lines = text.split('\n');
    lines.forEach((l, i) => {
      if (/^\t/.test(l)) {
        diags.push({ line: i, col: 0, end_line: i, end_col: 1, severity: 'error', message: 'Tabs are not allowed as indentation in YAML', source: 'synapseiq-lsp/yaml' });
      }
    });
    return diags;
  }

  // Generic bracket balance check for JS/TS/Rust/Go/Lua
  if (['javascript', 'typescript', 'rust', 'go'].includes(language)) {
    let depth = 0;
    let lastOpen = -1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') { depth++; lastOpen = i; }
      if (text[i] === '}') depth--;
    }
    if (depth !== 0) {
      const pos = depth > 0 ? lastOpen : text.length - 1;
      const before = text.slice(0, pos);
      const line = before.split('\n').length - 1;
      diags.push({ line, col: 0, end_line: line, end_col: 1, severity: 'warning', message: `Unbalanced braces (depth ${depth})`, source: 'synapseiq-lsp/balance' });
    }
  }

  return diags;
}

// ---------------------------------------------------------------------------
// Hover
// ---------------------------------------------------------------------------

function getHover(text, language, line, character) {
  const lines = text.split('\n');
  const currentLine = lines[line] || '';
  // Find the word at the given character position
  const before = currentLine.slice(0, character);
  const after = currentLine.slice(character);
  const wordBefore = before.match(/[\w.]+$/) || [''];
  const wordAfter = after.match(/^[\w.]+/) || [''];
  const word = wordBefore[0] + wordAfter[0];
  if (!word) return null;

  // Find where this symbol is defined
  const symbols = extractSymbols(text, language);
  const def = symbols.find(s => s.name === word);
  if (def) {
    return { contents: `**${def.kind}** \`${def.name}\` — defined at line ${def.line + 1}` };
  }
  return { contents: `\`${word}\`` };
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-SynapseIQ-Version', VERSION);

  // Health
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/healthz')) {
    return send(res, 200, { status: 'ok', service: 'synapseiq-lsp', version: VERSION, port: PORT, languages: SUPPORTED_LANGUAGES });
  }

  if (req.method !== 'POST') {
    return send(res, 405, { error: 'method not allowed' });
  }

  let body;
  try { body = await readBody(req); }
  catch (e) { return send(res, 400, { error: 'invalid JSON body' }); }

  const { file, text = '', language: reqLang, line = 0, character = 0 } = body;
  const language = reqLang || detectLanguage(file);
  const now = new Date().toISOString();

  if (req.url === '/lsp/diagnostics') {
    const diagnostics = extractDiagnostics(text, language, file);
    return send(res, 200, {
      schema: 'sourceos.synapseiq.lsp.diagnostics.v0',
      file: file || null,
      language,
      diagnostics,
      diagnostic_count: diagnostics.length,
      analyzed_at: now,
    });
  }

  if (req.url === '/lsp/symbols') {
    const symbols = extractSymbols(text, language);
    return send(res, 200, {
      schema: 'sourceos.synapseiq.lsp.symbols.v0',
      file: file || null,
      language,
      symbols,
      symbol_count: symbols.length,
      analyzed_at: now,
    });
  }

  if (req.url === '/lsp/hover') {
    const hover = getHover(text, language, line, character);
    return send(res, 200, {
      schema: 'sourceos.synapseiq.lsp.hover.v0',
      file: file || null,
      language,
      hover,
      analyzed_at: now,
    });
  }

  if (req.url === '/lsp/complete') {
    const symbols = extractSymbols(text, language);
    const completions = symbols.map(s => ({ label: s.name, kind: s.kind, detail: `${s.kind} at line ${s.line + 1}` }));
    return send(res, 200, {
      schema: 'sourceos.synapseiq.lsp.completions.v0',
      file: file || null,
      language,
      completions,
      analyzed_at: now,
    });
  }

  return send(res, 404, { error: 'unknown endpoint', url: req.url });
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[synapseiq-lsp] Port ${PORT} already in use — server may already be running.`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[synapseiq-lsp] v${VERSION} listening on http://127.0.0.1:${PORT}`);
});

process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT', () => { server.close(); process.exit(0); });

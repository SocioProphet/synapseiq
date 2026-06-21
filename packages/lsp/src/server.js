#!/usr/bin/env node
// SynapseIQ Language Server — HTTP gateway + LSP stdio transport
// Real AST parsing: TypeScript compiler API for TS/JS, python3 ast for Python.
// Fallback: Babel parser (JS/JSX), regex heuristics for everything else.

'use strict';

const http = require('node:http');
const { spawnSync } = require('node:child_process');

// Optional parsers — loaded once, used everywhere
let ts = null;
let babelParser = null;
try { ts = require('typescript'); } catch (_) {}
try { babelParser = require('@babel/parser'); } catch (_) {}

// LRU cache for TS language service instances (~15ms → ~1ms after first call)
const _tsLsCache = new Map();
const _LS_CACHE_MAX = 20;

function _evictOldestLS() {
  const key = _tsLsCache.keys().next().value;
  const entry = _tsLsCache.get(key);
  try { if (entry && entry.ls) entry.ls.dispose(); } catch (_) {}
  _tsLsCache.delete(key);
}

function _getOrCreateLS(text, filename) {
  if (!ts) return null;
  const key = `${filename}::${text.length}::${text.slice(0, 80)}::${text.slice(-40)}`;
  if (_tsLsCache.has(key)) return _tsLsCache.get(key);
  if (_tsLsCache.size >= _LS_CACHE_MAX) _evictOldestLS();
  const ls = ts.createLanguageService(_makeTSHost(text, filename), ts.createDocumentRegistry());
  const entry = { ls };
  _tsLsCache.set(key, entry);
  return entry;
}

const PORT = parseInt(process.env.SYNAPSEIQ_LSP_PORT || '2087', 10);
const VERSION = '0.8.0';

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
// Real AST parsers (TypeScript compiler API)
// ---------------------------------------------------------------------------

function extractSymbolsWithTSAPI(text, filename) {
  if (!ts) return null;
  try {
    const sf = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
    const symbols = [];

    function pos(node) {
      const { line, character } = ts.getLineAndCharacterOfPosition(sf, node.getStart(sf));
      return { line, col: character };
    }

    function visit(node) {
      if (ts.isFunctionDeclaration(node) && node.name) {
        symbols.push({ name: node.name.text, kind: 'function', ...pos(node) });
      } else if (ts.isClassDeclaration(node) && node.name) {
        symbols.push({ name: node.name.text, kind: 'class', ...pos(node) });
      } else if (ts.isInterfaceDeclaration(node)) {
        symbols.push({ name: node.name.text, kind: 'interface', ...pos(node) });
      } else if (ts.isTypeAliasDeclaration(node)) {
        symbols.push({ name: node.name.text, kind: 'type', ...pos(node) });
      } else if (ts.isEnumDeclaration(node)) {
        symbols.push({ name: node.name.text, kind: 'enum', ...pos(node) });
      } else if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            const isArrow = decl.initializer && (
              ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)
            );
            symbols.push({ name: decl.name.text, kind: isArrow ? 'function' : 'variable', ...pos(decl) });
          }
        }
      } else if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
        symbols.push({ name: node.name.text, kind: 'function', ...pos(node) });
      } else if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && node.name) {
        symbols.push({ name: node.name.text, kind: 'function', ...pos(node) });
      }
      ts.forEachChild(node, visit);
    }

    visit(sf);
    return symbols;
  } catch (_) {
    return null;
  }
}

function getDiagnosticsWithTSAPI(text, filename) {
  if (!ts) return null;
  try {
    const fname = filename || 'file.ts';
    const compilerHost = {
      getSourceFile: (name) => name === fname
        ? ts.createSourceFile(name, text, ts.ScriptTarget.Latest)
        : undefined,
      writeFile: () => {},
      getDefaultLibFileName: () => 'lib.d.ts',
      useCaseSensitiveFileNames: () => false,
      getCanonicalFileName: (f) => f,
      getCurrentDirectory: () => '/',
      getNewLine: () => '\n',
      fileExists: (f) => f === fname,
      readFile: (f) => f === fname ? text : undefined,
      directoryExists: () => true,
      getDirectories: () => [],
    };
    const program = ts.createProgram([fname], {
      noEmit: true,
      strict: false,
      allowJs: true,
      checkJs: fname.endsWith('.js') || fname.endsWith('.jsx'),
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.ESNext,
      skipLibCheck: true,
      noResolve: true,
      noLib: true,
    }, compilerHost);
    const sf = program.getSourceFile(fname);
    if (!sf) return null;
    const rawDiags = ts.getPreEmitDiagnostics(program, sf);
    // Filter structural/stdlib errors that don't belong to user code
    const NOISE_CODES = new Set([2318, 6053, 6054, 1208]);
    return Array.from(rawDiags).filter(d => !NOISE_CODES.has(d.code) && d.file).map(d => {
      let line = 0, col = 0, endLine = 0, endCol = 1;
      if (d.file && d.start !== undefined) {
        const s = ts.getLineAndCharacterOfPosition(d.file, d.start);
        line = s.line; col = s.character;
        if (d.length) {
          const e = ts.getLineAndCharacterOfPosition(d.file, d.start + d.length);
          endLine = e.line; endCol = e.character;
        } else { endLine = line; endCol = col + 1; }
      }
      return {
        line, col, end_line: endLine, end_col: endCol,
        severity: d.category === ts.DiagnosticCategory.Error ? 'error' : 'warning',
        message: ts.flattenDiagnosticMessageText(d.messageText, ' '),
        code: d.code,
        source: 'synapseiq-lsp/typescript',
      };
    });
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Symbol extraction
// ---------------------------------------------------------------------------

function extractSymbols(text, language, filename) {
  const symbols = [];

  const addMatch = (pattern, kind, opts = {}) => {
    const re = new RegExp(pattern, opts.flags || 'gm');
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
    case 'javascript': {
      const ext = language === 'typescript' ? 'ts' : 'js';
      const fname = filename || `file.${ext}`;
      const tsSymbols = extractSymbolsWithTSAPI(text, fname);
      if (tsSymbols) return tsSymbols;
      // Fallback to Babel parser
      if (babelParser) {
        try {
          const ast = babelParser.parse(text, {
            sourceType: 'unambiguous', plugins: ['typescript', 'jsx', 'decorators-legacy'],
          });
          const walk = (node) => {
            if (!node || typeof node !== 'object') return;
            const { type, id, key, loc } = node;
            const line = (loc && loc.start && loc.start.line - 1) || 0;
            const col = (loc && loc.start && loc.start.column) || 0;
            if ((type === 'FunctionDeclaration' || type === 'FunctionExpression') && id) {
              symbols.push({ name: id.name, kind: 'function', line, col });
            } else if (type === 'ClassDeclaration' && id) {
              symbols.push({ name: id.name, kind: 'class', line, col });
            } else if (type === 'TSInterfaceDeclaration') {
              symbols.push({ name: id.name, kind: 'interface', line, col });
            } else if (type === 'TSTypeAliasDeclaration') {
              symbols.push({ name: id.name, kind: 'type', line, col });
            } else if (type === 'TSEnumDeclaration') {
              symbols.push({ name: id.name, kind: 'enum', line, col });
            } else if (type === 'VariableDeclarator' && id && id.type === 'Identifier') {
              const isArrow = node.init && (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression');
              symbols.push({ name: id.name, kind: isArrow ? 'function' : 'variable', line, col });
            } else if ((type === 'ClassMethod' || type === 'ObjectMethod') && key && key.type === 'Identifier') {
              symbols.push({ name: key.name, kind: 'function', line, col });
            }
            for (const v of Object.values(node)) {
              if (Array.isArray(v)) v.forEach(walk);
              else if (v && typeof v === 'object' && v.type) walk(v);
            }
          };
          walk(ast.program);
          return symbols;
        } catch (_) { /* fall through to regex */ }
      }
      // Last resort: regex
      addMatch(/(?:^|\s)(?:export\s+)?(?:async\s+)?function\s+(\w+)/, 'function');
      addMatch(/(?:^|\s)class\s+(\w+)[\s{]/, 'class');
      addMatch(/(?:^|\s)interface\s+(\w+)[\s{]/, 'interface');
      addMatch(/(?:^|\s)type\s+(\w+)\s*=/, 'type');
      addMatch(/(?:^|\s)(?:const|let|var)\s+(\w+)\s*=/, 'variable');
      break;
    }

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

  // TypeScript compiler — real type diagnostics for TS/JS
  if (language === 'typescript' || language === 'javascript') {
    const ext = language === 'typescript' ? 'ts' : 'js';
    const fname = (filename && filename.match(/\.[tj]sx?$/)) ? filename : `file.${ext}`;
    const tsDiags = getDiagnosticsWithTSAPI(text, fname);
    if (tsDiags !== null) return tsDiags;
    // Fallback: bracket balance
  }

  // Rust — real diagnostics via rustc --error-format=json (stdin mode)
  if (language === 'rust') {
    const res = spawnSync('rustc', ['--error-format=json', '--edition=2021', '--crate-type=lib', '-'], {
      input: text, encoding: 'utf8', timeout: 15000,
    });
    // rustc writes JSON diagnostics to stderr, one per line
    const output = (res.stderr || '') + (res.stdout || '');
    for (const raw of output.split('\n')) {
      if (!raw.trim().startsWith('{')) continue;
      try {
        const d = JSON.parse(raw);
        if (!d.spans || d.spans.length === 0) continue;
        const span = d.spans.find(s => s.is_primary) || d.spans[0];
        const sev = d.level === 'error' ? 'error' : d.level === 'warning' ? 'warning' : 'info';
        diags.push({
          line: (span.line_start || 1) - 1,
          col: (span.column_start || 1) - 1,
          end_line: (span.line_end || span.line_start || 1) - 1,
          end_col: (span.column_end || span.column_start || 1) - 1,
          severity: sev,
          message: d.message || '',
          code: d.code ? (d.code.code || '') : '',
          source: 'synapseiq-lsp/rustc',
        });
      } catch (_) { /* non-JSON line */ }
    }
    if (diags.length > 0) return diags;
    // rustc not installed — fall through to bracket balance
  }

  // Go — real diagnostics via go build (writes to temp file, reads stderr)
  if (language === 'go') {
    const os = require('node:os');
    const fs = require('node:fs');
    const path = require('node:path');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapseiq-go-'));
    const tmpFile = path.join(tmpDir, 'synapseiq_check.go');
    try {
      fs.writeFileSync(tmpFile, text, 'utf8');
      const res = spawnSync('go', ['build', '-gcflags=-e', tmpFile], {
        encoding: 'utf8', timeout: 15000,
        env: { ...process.env, GOPATH: tmpDir },
      });
      const stderr = res.stderr || '';
      // go build errors: "filename:line:col: message"
      const re = /^.*?:(\d+):(\d+):\s+(.+)$/gm;
      let m;
      while ((m = re.exec(stderr)) !== null) {
        const line = parseInt(m[1], 10) - 1;
        const col = parseInt(m[2], 10) - 1;
        diags.push({ line, col, end_line: line, end_col: col + 1, severity: 'error', message: m[3], source: 'synapseiq-lsp/go' });
      }
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }
    if (diags.length > 0) return diags;
    // go not installed — fall through
  }

  // Lua — syntax check via luac -p (stdin not supported, use temp file)
  if (language === 'lua') {
    const os = require('node:os');
    const fs = require('node:fs');
    const path = require('node:path');
    const tmpFile = path.join(os.tmpdir(), `synapseiq-lua-${Date.now()}.lua`);
    try {
      fs.writeFileSync(tmpFile, text, 'utf8');
      const res = spawnSync('luac', ['-p', tmpFile], { encoding: 'utf8', timeout: 5000 });
      const stderr = res.stderr || '';
      // luac: luac: file:line: message
      const re = /[^:]+:(\d+):\s+(.+)/g;
      let m;
      while ((m = re.exec(stderr)) !== null) {
        const line = parseInt(m[1], 10) - 1;
        diags.push({ line, col: 0, end_line: line, end_col: 1, severity: 'error', message: m[2], source: 'synapseiq-lsp/luac' });
      }
    } finally {
      try { require('node:fs').unlinkSync(tmpFile); } catch (_) {}
    }
    return diags;
  }

  // Shell — bash -n syntax check
  if (language === 'shell') {
    const res = spawnSync('bash', ['-n', '/dev/stdin'], { input: text, encoding: 'utf8', timeout: 5000 });
    const stderr = res.stderr || '';
    const re = /line (\d+):\s*(.+)/g;
    let m;
    while ((m = re.exec(stderr)) !== null) {
      const line = parseInt(m[1], 10) - 1;
      diags.push({ line, col: 0, end_line: line, end_col: 1, severity: 'error', message: m[2], source: 'synapseiq-lsp/bash' });
    }
    return diags;
  }

  // Fallback bracket balance for Rust/Go if compiler not installed
  if (['rust', 'go', 'javascript', 'typescript'].includes(language)) {
    let depth = 0, lastOpen = -1;
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

// Shared TS language-service host — accepts a single in-memory file.
// All TS features (hover, definition, signatureHelp) use this.
function _makeTSHost(text, filename) {
  const fileMap = new Map([[filename || '/__virtual__.ts', text]]);

  // W2-C: Multi-file support — discover tsconfig.json and include project files
  if (filename && ts) {
    try {
      const path = require('node:path');
      const fs = require('node:fs');
      // Walk up from file's directory to find tsconfig.json
      let dir = path.dirname(filename);
      let tsconfig = null;
      for (let i = 0; i < 8 && dir !== path.dirname(dir); i++) {
        const candidate = path.join(dir, 'tsconfig.json');
        if (fs.existsSync(candidate)) { tsconfig = candidate; break; }
        dir = path.dirname(dir);
      }
      if (tsconfig) {
        const projectRoot = path.dirname(tsconfig);
        // Add up to 60 project TS/JS files (avoid huge projects)
        const scanDir = (d, depth) => {
          if (depth > 4) return;
          try {
            for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
              if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') continue;
              const full = path.join(d, entry.name);
              if (entry.isDirectory()) { scanDir(full, depth + 1); }
              else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && full !== filename && fileMap.size < 60) {
                try { fileMap.set(full, fs.readFileSync(full, 'utf8')); } catch (_) {}
              }
            }
          } catch (_) {}
        };
        scanDir(projectRoot, 0);
      }
    } catch (_) {}
  }

  return {
    getScriptFileNames:     () => Array.from(fileMap.keys()),
    getScriptVersion:       () => '1',
    getScriptSnapshot:      (name) => {
      const src = fileMap.get(name);
      return src !== undefined ? ts.ScriptSnapshot.fromString(src) : undefined;
    },
    getCurrentDirectory:    () => '/',
    getCompilationSettings: () => ({
      noEmit: true, strict: false, allowJs: true,
      target: ts.ScriptTarget.Latest, module: ts.ModuleKind.ESNext,
      noResolve: true, noLib: true, skipLibCheck: true,
    }),
    getDefaultLibFileName:  () => '',
    fileExists:             (name) => fileMap.has(name),
    readFile:               (name) => fileMap.get(name),
    directoryExists:        () => true,
    getDirectories:         () => [],
    useCaseSensitiveFileNames: () => false,
  };
}

// Compute character offset from (line, character) — used by all TS features.
function _tsOffset(text, line, character) {
  const lines = text.split('\n');
  let offset = 0;
  for (let i = 0; i < line && i < lines.length; i++) offset += lines[i].length + 1;
  return offset + character;
}

function getHoverWithTSLanguageService(text, filename, line, character) {
  if (!ts) return null;
  try {
    const offset = _tsOffset(text, line, character);
    const cached = _getOrCreateLS(text, filename);
    if (!cached) return null;
    const langSvc = cached.ls;
    const info = langSvc.getQuickInfoAtPosition(filename, offset);
    if (!info || !info.displayParts) return null;
    const display = info.displayParts.map(p => p.text).join('');
    const doc = info.documentation && info.documentation.length > 0
      ? '\n\n' + info.documentation.map(p => p.text).join('') : '';
    return { contents: `\`\`\`typescript\n${display}\n\`\`\`` + doc };
  } catch (_) {
    return null;
  }
}

function getDefinitionWithTSLanguageService(text, filename, line, character) {
  if (!ts) return null;
  try {
    const offset = _tsOffset(text, line, character);
    const cached = _getOrCreateLS(text, filename);
    if (!cached) return null;
    const langSvc = cached.ls;
    const defs = langSvc.getDefinitionAtPosition(filename, offset);
    if (!defs || defs.length === 0) return null;
    const def = defs.find(d => d.fileName === filename) || defs[0];
    if (def.fileName !== filename) return null;
    const sf = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
    const start = ts.getLineAndCharacterOfPosition(sf, def.textSpan.start);
    const end   = ts.getLineAndCharacterOfPosition(sf, def.textSpan.start + def.textSpan.length);
    return { line: start.line, col: start.character, end_line: end.line, end_col: end.character };
  } catch (_) {
    return null;
  }
}

function getSignatureHelpWithTSLanguageService(text, filename, line, character) {
  if (!ts) return null;
  try {
    const offset = _tsOffset(text, line, character);
    const cached = _getOrCreateLS(text, filename);
    if (!cached) return null;
    const langSvc = cached.ls;
    const help = langSvc.getSignatureHelpItems(filename, offset, undefined);
    if (!help || help.items.length === 0) return null;

    const signatures = help.items.map(item => {
      // Build the full label by joining prefix, params (comma-separated), suffix
      const prefix   = item.prefixDisplayParts.map(p => p.text).join('');
      const suffix   = item.suffixDisplayParts.map(p => p.text).join('');
      const sep      = item.separatorDisplayParts.map(p => p.text).join('');
      const paramLabels = item.parameters.map(p => p.displayParts.map(d => d.text).join(''));
      const label    = prefix + paramLabels.join(sep) + suffix;

      // LSP wants [start, end] character offsets into the label for each param
      let cursor = prefix.length;
      const lspParams = item.parameters.map((p, i) => {
        const pLabel = paramLabels[i];
        const start  = cursor;
        const end    = cursor + pLabel.length;
        cursor = end + sep.length;
        const doc = p.documentation && p.documentation.length > 0
          ? { kind: 'markdown', value: p.documentation.map(d => d.text).join('') } : undefined;
        return { label: [start, end], ...(doc ? { documentation: doc } : {}) };
      });

      const itemDoc = item.documentation && item.documentation.length > 0
        ? { kind: 'markdown', value: item.documentation.map(d => d.text).join('') } : undefined;

      return {
        label: label,
        ...(itemDoc ? { documentation: itemDoc } : {}),
        parameters: lspParams,
      };
    });

    return {
      signatures,
      activeSignature: Math.min(help.selectedItemIndex || 0, signatures.length - 1),
      activeParameter: Math.min(help.argumentIndex   || 0,
        (signatures[help.selectedItemIndex || 0]?.parameters?.length || 1) - 1),
    };
  } catch (_) {
    return null;
  }
}

function getHover(text, language, line, character) {
  // TypeScript/JavaScript: try real language service first
  if ((language === 'typescript' || language === 'javascript') && ts) {
    const ext = language === 'typescript' ? 'ts' : 'js';
    const fname = `hover.${ext}`;
    const result = getHoverWithTSLanguageService(text, fname, line, character);
    if (result) return result;
  }

  const lines = text.split('\n');
  const currentLine = lines[line] || '';
  const before = currentLine.slice(0, character);
  const after = currentLine.slice(character);
  const wordBefore = (before.match(/[\w.]+$/) || [''])[0];
  const wordAfter = (after.match(/^[\w.]+/) || [''])[0];
  const word = wordBefore + wordAfter;
  if (!word) return null;

  const symbols = extractSymbols(text, language, null);
  const def = symbols.find(s => s.name === word);
  if (def) {
    return { contents: `**${def.kind}** \`${def.name}\` — line ${def.line + 1}` };
  }
  return { contents: `\`${word}\`` };
}

function getReferences(text, filename, line, character) {
  const offset = _tsOffset(text, line, character);
  const lines = text.split('\n');
  const curLine = lines[line] || '';
  const word = (curLine.slice(0, character).match(/\w+$/) || [''])[0]
             + (curLine.slice(character).match(/^\w+/) || [''])[0];
  if (!word) return [];

  // TS/JS: use language service for accurate cross-reference tracking
  if (ts && filename) {
    try {
      const cached = _getOrCreateLS(text, filename);
      if (cached) {
        const refs = cached.ls.getReferencesAtPosition(filename, offset);
        if (refs && refs.length > 0) {
          const sf = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
          const results = refs.filter(r => r.fileName === filename).map(r => {
            const s = ts.getLineAndCharacterOfPosition(sf, r.textSpan.start);
            const e = ts.getLineAndCharacterOfPosition(sf, r.textSpan.start + r.textSpan.length);
            return { line: s.line, col: s.character, end_line: e.line, end_col: e.character };
          });
          if (results.length > 0) return results;
        }
      }
    } catch (_) {}
  }

  // Fallback: regex scan for all occurrences of the word
  const refs = [];
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
  lines.forEach((l, i) => {
    let m;
    while ((m = re.exec(l)) !== null) {
      refs.push({ line: i, col: m.index, end_line: i, end_col: m.index + word.length });
    }
  });
  return refs;
}

function formatDocument(text, language, filename) {
  const ext = (filename || '').replace(/.*\./, '').toLowerCase() || language;

  const tryFmt = (cmd, args, input) => {
    try {
      const r = spawnSync(cmd, args, { input, encoding: 'utf8', timeout: 10000 });
      return (r.status === 0 && r.stdout && r.stdout !== input) ? r.stdout : null;
    } catch (_) { return null; }
  };

  const tryFmtFile = (cmd, args) => {
    const os = require('node:os'), fs = require('node:fs'), path = require('node:path');
    const tmp = path.join(os.tmpdir(), `synapseiq-fmt-${Date.now()}.${ext}`);
    try {
      fs.writeFileSync(tmp, text, 'utf8');
      const r = spawnSync(cmd, [...args, tmp], { encoding: 'utf8', timeout: 10000 });
      const out = r.status === 0 ? fs.readFileSync(tmp, 'utf8') : null;
      return (out && out !== text) ? out : null;
    } catch (_) { return null; } finally {
      try { require('node:fs').unlinkSync(tmp); } catch (_) {}
    }
  };

  if (language === 'typescript' || language === 'javascript') {
    const parser = language === 'typescript' ? 'babel-ts' : 'babel';
    const fp = filename || `file.${ext}`;
    return tryFmt('prettier', ['--parser', parser, '--stdin-filepath', fp], text)
        || tryFmt('npx', ['prettier', '--parser', parser, '--stdin-filepath', fp], text);
  }
  if (language === 'json') return tryFmt('prettier', ['--parser', 'json', '--stdin-filepath', 'file.json'], text);
  if (language === 'yaml') return tryFmt('prettier', ['--parser', 'yaml', '--stdin-filepath', 'file.yaml'], text);
  if (language === 'python') return tryFmt('black', ['--quiet', '-'], text) || tryFmt('ruff', ['format', '--quiet', '-'], text);
  if (language === 'rust') return tryFmt('rustfmt', ['--edition', '2021'], text);
  if (language === 'go') return tryFmt('gofmt', [], text);
  if (language === 'lua') return tryFmt('stylua', ['-'], text);
  return null;
}

function getInlayHints(text, filename) {
  if (!ts || !filename) return [];
  try {
    const cached = _getOrCreateLS(text, filename);
    if (!cached || typeof cached.ls.getInlayHints !== 'function') return [];
    const sf = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
    const span = ts.createTextSpan(0, text.length);
    const hints = cached.ls.getInlayHints(filename, span, {
      includeInlayParameterNameHints: 'all',
      includeInlayParameterNameHintsWhenArgumentMatchesName: false,
      includeInlayFunctionParameterTypeHints: true,
      includeInlayVariableTypeHints: true,
      includeInlayPropertyDeclarationTypeHints: true,
      includeInlayFunctionLikeReturnTypeHints: true,
      includeInlayEnumMemberValueHints: false,
    });
    return (hints || []).map(h => {
      const pos = ts.getLineAndCharacterOfPosition(sf, h.position);
      const label = typeof h.text === 'string' ? h.text
        : Array.isArray(h.text) ? h.text.map(p => (typeof p === 'string' ? p : p.text)).join('') : String(h.text || '');
      return {
        position: { line: pos.line, character: pos.character },
        label,
        kind: h.kind === 'Type' ? 1 : 2,
        paddingLeft: !!(h.whitespaceBefore),
        paddingRight: !!(h.whitespaceAfter),
      };
    }).filter(h => h.label);
  } catch (_) { return []; }
}

function getCodeActions(text, filename, range, diagnostics) {
  const actions = [];

  // Quick fix: unused variable
  for (const diag of (diagnostics || [])) {
    const msg = (diag.message || '').toLowerCase();
    const lineText = text.split('\n')[diag.range?.start?.line || 0] || '';

    if (msg.includes('is declared but') || msg.includes('is never read')) {
      const varMatch = diag.message.match(/'([^']+)'/);
      if (varMatch) {
        actions.push({
          title: `Remove unused variable '${varMatch[1]}'`,
          kind: 'quickfix',
          diagnostics: [diag],
          edit: { changes: { [filename]: [{ range: diag.range, newText: '' }] } },
        });
      }
    }
    if (msg.includes('cannot find name') || msg.includes('is not defined')) {
      const nameMatch = diag.message.match(/'([^']+)'/);
      if (nameMatch) {
        actions.push({
          title: `Add import for '${nameMatch[1]}'`,
          kind: 'quickfix',
          diagnostics: [diag],
          command: { title: 'Add import', command: 'turtle.addImport', arguments: [filename, nameMatch[1]] },
        });
      }
    }
    if (msg.includes('missing semicolon') || msg.includes("';'")) {
      actions.push({
        title: 'Add missing semicolon',
        kind: 'quickfix',
        diagnostics: [diag],
        edit: { changes: { [filename]: [{ range: { start: diag.range?.end, end: diag.range?.end }, newText: ';' }] } },
      });
    }
  }

  // Refactor actions
  const lineStart = range?.start?.line || 0;
  const lineEnd = range?.end?.line || lineStart;
  const selectedLines = text.split('\n').slice(lineStart, lineEnd + 1);
  const selectedText = selectedLines.join('\n').trim();

  if (selectedText.length > 10) {
    actions.push({
      title: 'Extract to function',
      kind: 'refactor.extract',
      command: { title: 'Extract', command: 'turtle.extractFunction', arguments: [filename, range, selectedText] },
    });
    actions.push({
      title: 'Extract to variable',
      kind: 'refactor.extract',
      command: { title: 'Extract', command: 'turtle.extractVariable', arguments: [filename, range, selectedText] },
    });
  }

  // Source actions
  actions.push({
    title: 'Organize imports',
    kind: 'source.organizeImports',
    command: { title: 'Organize', command: 'turtle.organizeImports', arguments: [filename] },
  });

  return actions;
}

function getWorkspaceSymbols(query, projectRoot) {
  const symbols = [];
  const { readdirSync, statSync, readFileSync } = require('fs');
  const path = require('node:path');
  const MAX_FILES = 40;
  let fileCount = 0;

  function walk(dir, depth) {
    if (depth > 4 || fileCount >= MAX_FILES) return;
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      if (name.startsWith('.') || name === 'node_modules' || name === 'dist' || name === 'build') continue;
      const full = path.join(dir, name);
      let stat;
      try { stat = statSync(full); } catch { continue; }
      if (stat.isDirectory()) {
        walk(full, depth + 1);
      } else if (/\.(ts|tsx|js|jsx|py|go|rs)$/.test(name) && fileCount < MAX_FILES) {
        fileCount++;
        let src;
        try { src = readFileSync(full, 'utf8'); } catch { continue; }
        const lines = src.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const m = line.match(/^(?:export\s+)?(?:async\s+)?(?:function|class|const|let|var|def|pub fn|fn)\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
          if (m) {
            const symName = m[1];
            if (!query || symName.toLowerCase().includes(query.toLowerCase())) {
              symbols.push({
                name: symName,
                kind: line.includes('class') ? 5 : line.includes('function') || line.includes('def') || line.includes(' fn ') ? 12 : 13,
                location: { uri: `file://${full}`, range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } } },
              });
            }
          }
          if (symbols.length >= 50) return;
        }
      }
    }
  }
  walk(projectRoot || process.cwd(), 0);
  return symbols;
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
    return send(res, 200, {
      status: 'ok', service: 'synapseiq-lsp', version: VERSION, port: PORT,
      languages: SUPPORTED_LANGUAGES,
      capabilities: {
        typescript_ast:         ts !== null,
        babel_parser:           babelParser !== null,
        python_ast:             true,
        real_type_checking:     ts !== null,
        typescript_hover:       ts !== null,
        typescript_definition:  ts !== null,
        typescript_signature:   ts !== null,
        typescript_references:  ts !== null,
        typescript_formatting:  true,
        typescript_inlay_hints: ts !== null,
        typescript_multi_file:  ts !== null,
        rust_diagnostics:       true,
        go_diagnostics:         true,
        lua_diagnostics:        true,
        shell_diagnostics:      true,
      },
    });
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
    const symbols = extractSymbols(text, language, file);
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
      file: file || null, language, hover, analyzed_at: now,
    });
  }

  if (req.url === '/lsp/definition') {
    let def = null;
    if ((language === 'typescript' || language === 'javascript') && ts && file) {
      def = getDefinitionWithTSLanguageService(text, file, line, character);
    }
    if (!def) {
      const lines = text.split('\n');
      const curLine = lines[line] || '';
      const word = (curLine.slice(0, character).match(/\w+$/) || [''])[0]
                 + (curLine.slice(character).match(/^\w+/) || [''])[0];
      if (word) {
        const sym = extractSymbols(text, language, file).find(s => s.name === word);
        if (sym) def = { line: sym.line, col: sym.col || 0, end_line: sym.line, end_col: (sym.col || 0) + word.length };
      }
    }
    return send(res, 200, {
      schema: 'sourceos.synapseiq.lsp.definition.v0',
      file: file || null, language, definition: def, analyzed_at: now,
    });
  }

  if (req.url === '/lsp/signature') {
    let help = null;
    if ((language === 'typescript' || language === 'javascript') && ts && file) {
      help = getSignatureHelpWithTSLanguageService(text, file, line, character);
    }
    return send(res, 200, {
      schema: 'sourceos.synapseiq.lsp.signature.v0',
      file: file || null, language, signature_help: help, analyzed_at: now,
    });
  }

  if (req.url === '/lsp/references') {
    const refs = getReferences(text, file, line, character);
    return send(res, 200, {
      schema: 'sourceos.synapseiq.lsp.references.v0',
      file: file || null, language, references: refs, reference_count: refs.length, analyzed_at: now,
    });
  }

  if (req.url === '/lsp/format') {
    const formatted = formatDocument(text, language, file);
    return send(res, 200, {
      schema: 'sourceos.synapseiq.lsp.format.v0',
      file: file || null, language, formatted, available: formatted !== null, analyzed_at: now,
    });
  }

  if (req.url === '/lsp/inlay-hints') {
    const hints = (language === 'typescript' || language === 'javascript') ? getInlayHints(text, file) : [];
    return send(res, 200, {
      schema: 'sourceos.synapseiq.lsp.inlay-hints.v0',
      file: file || null, language, hints, hint_count: hints.length, analyzed_at: now,
    });
  }

  if (req.url === '/lsp/complete') {
    const symbols = extractSymbols(text, language, file);
    const completions = symbols.map(s => ({ label: s.name, kind: s.kind, detail: `${s.kind} at line ${s.line + 1}` }));
    return send(res, 200, {
      schema: 'sourceos.synapseiq.lsp.completions.v0',
      file: file || null,
      language,
      completions,
      analyzed_at: now,
    });
  }

  if (req.url === '/lsp/code-actions' && req.method === 'POST') {
    const { text: caText, filename: caFile, range: caRange, diagnostics: caDiags } = body;
    return send(res, 200, { code_actions: getCodeActions(caText || text, caFile || file, caRange, caDiags) });
  }

  if (req.url === '/lsp/workspace-symbols' && req.method === 'POST') {
    const { query: wsQuery, cwd: wsCwd } = body;
    return send(res, 200, { symbols: getWorkspaceSymbols(wsQuery, wsCwd) });
  }

  if (req.url === '/lsp/workspace-diagnostics' && req.method === 'POST') {
    const { files: wdFiles, cwd: wdCwd } = body;
    const results = {};
    const filesToCheck = wdFiles && wdFiles.length > 0 ? [...wdFiles] : [];
    if (filesToCheck.length === 0 && wdCwd) {
      const { spawnSync: sp } = require('child_process');
      const r = sp('git', ['diff', '--name-only', 'HEAD'], { cwd: wdCwd, encoding: 'utf8' });
      if (r.status === 0) {
        r.stdout.split('\n').filter(f => /\.(ts|tsx|js|jsx|py)$/.test(f)).forEach(f => {
          filesToCheck.push(require('node:path').join(wdCwd, f));
        });
      }
    }
    for (const fname of filesToCheck.slice(0, 20)) {
      try {
        const { readFileSync } = require('fs');
        const src = readFileSync(fname, 'utf8');
        const lang = detectLanguage(fname);
        const diags = extractDiagnostics(src, lang, fname);
        if (diags.length > 0) results[fname] = diags;
      } catch { /* skip unreadable */ }
    }
    return send(res, 200, { diagnostics: results, files_checked: filesToCheck.length });
  }

  if (req.url === '/lsp/rename' && req.method === 'POST') {
    const { text: renText, filename: renFile, line: renLine, character: renChar, new_name: renNewName } = body;
    if (!renText || !renNewName) return send(res, 200, { changes: {} });
    const renLines = renText.split('\n');
    const lineText = renLines[renLine || 0] || '';
    const before = lineText.slice(0, renChar || 0);
    const after  = lineText.slice(renChar || 0);
    const wb = (before.match(/[A-Za-z_$][A-Za-z0-9_$]*$/) || [''])[0];
    const wa = (after.match(/^[A-Za-z0-9_$]*/) || [''])[0];
    const oldName = wb + wa;
    if (!oldName) return send(res, 200, { changes: {} });
    const edits = [];
    const re = new RegExp(`\\b${oldName.replace(/[$]/g, '\\$')}\\b`, 'g');
    renLines.forEach((ln, i) => {
      let m;
      while ((m = re.exec(ln)) !== null) {
        edits.push({ range: { start: { line: i, character: m.index }, end: { line: i, character: m.index + oldName.length } }, newText: renNewName });
      }
    });
    const uri = renFile ? `file://${renFile}` : 'file:///unknown';
    return send(res, 200, { changes: { [uri]: edits }, old_name: oldName, edit_count: edits.length });
  }

  if (req.url === '/lsp/document-symbols' && req.method === 'POST') {
    const { text: dsText, filename: dsFile } = body;
    const src = dsText || '';
    const symbols = [];
    src.split('\n').forEach((line, i) => {
      const m = line.match(/^(?:export\s+)?(?:async\s+)?(?:function|class|const|let|var|def|pub fn|fn|type|interface|enum)\s+([A-Za-z_$][A-Za-z0-9_$<>]*)/);
      if (m) {
        const k = line.includes('class')||line.includes('interface')||line.includes('enum') ? 5 : line.includes('function')||line.includes('def')||line.includes(' fn ') ? 12 : 13;
        symbols.push({ name: m[1], kind: k, range: { start:{line:i,character:0}, end:{line:i,character:line.length} }, selectionRange: { start:{line:i,character:0}, end:{line:i,character:line.length} } });
      }
    });
    return send(res, 200, { symbols });
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

// ============================================================
// LSP stdio transport (--lsp flag)
// ============================================================

if (process.argv.includes('--lsp')) {
  // Switch to LSP mode: disable HTTP server, start JSON-RPC over stdio
  server.close();
  runLspServer();
}

function runLspServer() {
  const fileCache = new Map();  // uri → { text, lang }
  let buffer = Buffer.alloc(0);

  process.stdin.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    processBuffer();
  });

  function processBuffer() {
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      const headers = buffer.slice(0, headerEnd).toString('utf8');
      const lenMatch = headers.match(/Content-Length:\s*(\d+)/i);
      if (!lenMatch) { buffer = buffer.slice(headerEnd + 4); continue; }
      const len = parseInt(lenMatch[1], 10);
      if (buffer.length < headerEnd + 4 + len) return;
      const body = buffer.slice(headerEnd + 4, headerEnd + 4 + len).toString('utf8');
      buffer = buffer.slice(headerEnd + 4 + len);
      try { handleMessage(JSON.parse(body), fileCache); } catch (_) {}
    }
  }

  function sendMessage(msg) {
    const body = JSON.stringify(msg);
    process.stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  }

  function respond(id, result) {
    sendMessage({ jsonrpc: '2.0', id, result });
  }

  function notify(method, params) {
    sendMessage({ jsonrpc: '2.0', method, params });
  }

  function pushDiagnostics(uri, text, lang) {
    const filename = uri.startsWith('file://') ? uri.slice(7) : null;
    const diags = extractDiagnostics(text, lang, filename);
    const sevMap = { error: 1, warning: 2, info: 3, hint: 4 };
    notify('textDocument/publishDiagnostics', {
      uri,
      diagnostics: diags.map(d => ({
        range: {
          start: { line: d.line || 0, character: d.col || 0 },
          end: { line: d.end_line || d.line || 0, character: d.end_col || (d.col || 0) + 1 },
        },
        severity: sevMap[d.severity] || 2,
        message: d.message,
        source: 'synapseiq-lsp',
      })),
    });
  }

  function handleMessage(msg, cache) {
    const { id, method, params } = msg;

    if (method === 'initialize') {
      respond(id, {
        capabilities: {
          textDocumentSync: 1,
          hoverProvider: true,
          definitionProvider: true,
          referencesProvider: true,
          completionProvider:    { triggerCharacters: ['.', '/', ':'] },
          signatureHelpProvider: { triggerCharacters: ['(', ',', '<'] },
          documentFormattingProvider: true,
          inlayHintProvider: { resolveProvider: false },
          codeActionProvider: { resolveProvider: false },
          workspaceSymbolProvider: true,
          documentSymbolProvider: true,
          renameProvider: { prepareProvider: true },
          selectionRangeProvider: true,
        },
        serverInfo: { name: 'synapseiq-lsp', version: VERSION },
      });
    } else if (method === 'initialized') {
      // no-op notification
    } else if (method === 'textDocument/didOpen') {
      const { uri, languageId, text } = params.textDocument;
      const lang = languageId || detectLanguage(uri.replace('file://', ''));
      cache.set(uri, { text, lang });
      pushDiagnostics(uri, text, lang);
    } else if (method === 'textDocument/didChange') {
      const uri = params.textDocument.uri;
      const text = (params.contentChanges[0] || {}).text || '';
      const entry = cache.get(uri) || { lang: detectLanguage(uri.replace('file://', '')) };
      entry.text = text;
      cache.set(uri, entry);
      pushDiagnostics(uri, text, entry.lang);
    } else if (method === 'textDocument/didClose') {
      cache.delete(params.textDocument.uri);
    } else if (method === 'textDocument/hover') {
      const uri = params.textDocument.uri;
      const entry = cache.get(uri);
      if (!entry || id === undefined) { if (id !== undefined) respond(id, null); return; }
      const { line, character } = params.position;
      const hover = getHover(entry.text, entry.lang, line, character);
      respond(id, hover ? { contents: { kind: 'markdown', value: hover.contents } } : null);

    } else if (method === 'textDocument/definition') {
      const uri = params.textDocument.uri;
      const entry = cache.get(uri);
      if (!entry || id === undefined) { if (id !== undefined) respond(id, null); return; }
      const { line, character } = params.position;
      const filename = uri.startsWith('file://') ? uri.slice(7) : null;

      // For TS/JS: use language service for accurate definition
      if ((entry.lang === 'typescript' || entry.lang === 'javascript') && ts && filename) {
        const ext = entry.lang === 'typescript' ? 'ts' : 'js';
        const def = getDefinitionWithTSLanguageService(entry.text, filename || `file.${ext}`, line, character);
        if (def) {
          respond(id, [{
            uri,
            range: {
              start: { line: def.line,     character: def.col     },
              end:   { line: def.end_line, character: def.end_col },
            },
          }]);
          return;
        }
      }

      // Fallback: symbol table lookup — find the word under cursor and locate its definition
      const lines = entry.text.split('\n');
      const curLine = lines[line] || '';
      const word = (curLine.slice(0, character).match(/\w+$/) || [''])[0]
                 + (curLine.slice(character).match(/^\w+/) || [''])[0];
      if (word) {
        const symbols = extractSymbols(entry.text, entry.lang, filename);
        const def = symbols.find(s => s.name === word);
        if (def) {
          respond(id, [{
            uri,
            range: {
              start: { line: def.line, character: def.col || 0 },
              end:   { line: def.line, character: (def.col || 0) + word.length },
            },
          }]);
          return;
        }
      }
      respond(id, null);

    } else if (method === 'textDocument/signatureHelp') {
      const uri = params.textDocument.uri;
      const entry = cache.get(uri);
      if (!entry || id === undefined) { if (id !== undefined) respond(id, null); return; }
      const { line, character } = params.position;
      const filename = uri.startsWith('file://') ? uri.slice(7) : null;

      if ((entry.lang === 'typescript' || entry.lang === 'javascript') && ts && filename) {
        const ext = entry.lang === 'typescript' ? 'ts' : 'js';
        const help = getSignatureHelpWithTSLanguageService(entry.text, filename || `file.${ext}`, line, character);
        respond(id, help || null);
      } else {
        respond(id, null);
      }

    } else if (method === 'textDocument/references') {
      const uri = params.textDocument.uri;
      const entry = cache.get(uri);
      if (!entry || id === undefined) { if (id !== undefined) respond(id, []); return; }
      const { line, character } = params.position;
      const filename = uri.startsWith('file://') ? uri.slice(7) : null;
      const refs = getReferences(entry.text, filename, line, character);
      respond(id, refs.map(r => ({
        uri,
        range: {
          start: { line: r.line, character: r.col },
          end:   { line: r.end_line, character: r.end_col },
        },
      })));

    } else if (method === 'textDocument/formatting') {
      const uri = params.textDocument.uri;
      const entry = cache.get(uri);
      if (!entry || id === undefined) { if (id !== undefined) respond(id, []); return; }
      const filename = uri.startsWith('file://') ? uri.slice(7) : null;
      const formatted = formatDocument(entry.text, entry.lang, filename);
      if (!formatted) { respond(id, []); return; }
      const lineCount = entry.text.split('\n').length;
      respond(id, [{
        range: { start: { line: 0, character: 0 }, end: { line: lineCount, character: 0 } },
        newText: formatted,
      }]);

    } else if (method === 'textDocument/inlayHint') {
      const uri = params.textDocument.uri;
      const entry = cache.get(uri);
      if (!entry || id === undefined) { if (id !== undefined) respond(id, []); return; }
      const filename = uri.startsWith('file://') ? uri.slice(7) : null;
      if ((entry.lang === 'typescript' || entry.lang === 'javascript') && filename) {
        respond(id, getInlayHints(entry.text, filename));
      } else {
        respond(id, []);
      }

    } else if (method === 'textDocument/completion') {
      const uri = params.textDocument.uri;
      const entry = cache.get(uri);
      if (!entry || id === undefined) { if (id !== undefined) respond(id, { isIncomplete: false, items: [] }); return; }
      const kindMap = { function: 3, class: 7, variable: 6, interface: 8, type: 25, struct: 22, enum: 13, trait: 8 };
      const filename = uri.startsWith('file://') ? uri.slice(7) : null;
      const items = extractSymbols(entry.text, entry.lang, filename).map(s => ({
        label: s.name,
        kind: kindMap[s.kind] || 6,
        detail: `${s.kind} (line ${s.line + 1})`,
        insertText: s.name,
      }));
      respond(id, { isIncomplete: false, items });
    } else if (method === 'textDocument/codeAction') {
      const { textDocument: caDoc, range: caRange, context: caCtx } = params;
      const caUri = caDoc?.uri || '';
      const caFile = caUri.replace('file://', '');
      const caEntry = cache.get(caUri);
      const caText = caEntry ? caEntry.text : '';
      const actions = getCodeActions(caText, caFile, caRange, caCtx?.diagnostics || []);
      respond(id, actions);

    } else if (method === 'workspace/symbol') {
      const { query: wsQ } = params;
      respond(id, getWorkspaceSymbols(wsQ, process.cwd()));

    } else if (method === 'textDocument/documentSymbol') {
      const dsUri = params.textDocument?.uri || '';
      const dsEntry = cache.get(dsUri);
      const dsText = dsEntry ? dsEntry.text : '';
      const dsSymbols = [];
      const dsLines = dsText.split('\n');
      for (let i = 0; i < dsLines.length; i++) {
        const dsLine = dsLines[i];
        const dsM = dsLine.match(/^(?:export\s+)?(?:async\s+)?(?:function|class|const|let|var|def|pub fn|fn|type|interface|enum)\s+([A-Za-z_$][A-Za-z0-9_$<>]*)/);
        if (dsM) {
          const dsKind = dsLine.includes('class') || dsLine.includes('interface') || dsLine.includes('enum') ? 5 :
                         dsLine.includes('function') || dsLine.includes('def') || dsLine.includes(' fn ') ? 12 : 13;
          dsSymbols.push({ name: dsM[1], kind: dsKind, range: { start: { line: i, character: 0 }, end: { line: i, character: dsLine.length } }, selectionRange: { start: { line: i, character: 0 }, end: { line: i, character: dsLine.length } } });
        }
      }
      respond(id, dsSymbols);

    } else if (method === 'textDocument/rename') {
      const { textDocument: rnDoc, position: rnPos, newName: rnNew } = params;
      const rnUri = rnDoc?.uri || '';
      const rnEntry = cache.get(rnUri);
      if (!rnEntry || id === undefined) { if (id !== undefined) respond(id, null); }
      else {
        const rnLines = rnEntry.text.split('\n');
        const rnLineText = rnLines[rnPos.line] || '';
        const rnBefore = rnLineText.slice(0, rnPos.character);
        const rnAfter  = rnLineText.slice(rnPos.character);
        const rnWb = rnBefore.match(/[A-Za-z_$][A-Za-z0-9_$]*$/) || [''];
        const rnWa = rnAfter.match(/^[A-Za-z0-9_$]*/) || [''];
        const rnOld = rnWb[0] + rnWa[0];
        if (!rnOld) { respond(id, null); }
        else {
          const rnEdits = [];
          const rnRe = new RegExp(`\\b${rnOld.replace(/[$]/g, '\\$')}\\b`, 'g');
          for (let i = 0; i < rnLines.length; i++) {
            let rnM;
            while ((rnM = rnRe.exec(rnLines[i])) !== null) {
              rnEdits.push({ range: { start: { line: i, character: rnM.index }, end: { line: i, character: rnM.index + rnOld.length } }, newText: rnNew });
            }
          }
          respond(id, { changes: { [rnUri]: rnEdits } });
        }
      }

    } else if (method === 'textDocument/prepareRename') {
      const { textDocument: prDoc, position: prPos } = params;
      const prUri = prDoc?.uri || '';
      const prEntry = cache.get(prUri);
      if (!prEntry || id === undefined) { if (id !== undefined) respond(id, null); }
      else {
        const prLineText = (prEntry.text.split('\n')[prPos.line] || '');
        const prBefore = prLineText.slice(0, prPos.character);
        const prAfter  = prLineText.slice(prPos.character);
        const prWb = prBefore.match(/[A-Za-z_$][A-Za-z0-9_$]*$/) || [''];
        const prWa = prAfter.match(/^[A-Za-z0-9_$]*/) || [''];
        const prStart = prPos.character - prWb[0].length;
        const prEnd   = prPos.character + prWa[0].length;
        respond(id, { range: { start: { line: prPos.line, character: prStart }, end: { line: prPos.line, character: prEnd } }, placeholder: prWb[0] + prWa[0] });
      }

    } else if (method === 'textDocument/selectionRange') {
      const { textDocument: srDoc, positions: srPositions } = params;
      const srUri = srDoc?.uri || '';
      const srEntry = cache.get(srUri);
      const srLines = srEntry ? srEntry.text.split('\n') : [];
      const srResult = (srPositions || []).map(srPos => {
        const srLineText = srLines[srPos.line] || '';
        const srWb = (srLineText.slice(0, srPos.character).match(/[A-Za-z0-9_$]+$/) || [''])[0];
        const srWa = (srLineText.slice(srPos.character).match(/^[A-Za-z0-9_$]*/) || [''])[0];
        const srWordStart = srPos.character - srWb.length;
        const srWordEnd   = srPos.character + srWa.length;
        return {
          range: { start: { line: srPos.line, character: srWordStart }, end: { line: srPos.line, character: srWordEnd } },
          parent: { range: { start: { line: srPos.line, character: 0 }, end: { line: srPos.line, character: srLineText.length } } },
        };
      });
      respond(id, srResult);

    } else if (method === 'shutdown') {
      if (id !== undefined) respond(id, null);
    } else if (method === 'exit') {
      process.exit(0);
    } else if (id !== undefined) {
      sendMessage({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
    }
  }

  process.stderr.write(`[synapseiq-lsp] v${VERSION} stdio LSP mode\n`);
}

/**
 * Release the MCP server to npm and the official MCP registry.
 *
 *   node scripts/release.mjs            # checks only: versions, git state, what is already published
 *   node scripts/release.mjs --publish  # same checks, then npm publish and mcp-publisher publish
 *
 * Bump the version in package.json and in both places in server.json first (the unit tests guard that they match).
 * npm publish runs prepublishOnly (typecheck, unit tests, build) and may open the browser for npm login or 2FA.
 * mcp-publisher is downloaded into a temp folder for this run and deleted afterwards; it signs in with GitHub
 * (device code) because the server name is io.github.castiquark/*.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const publish = process.argv.includes('--publish');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const server = JSON.parse(readFileSync(join(root, 'server.json'), 'utf8'));
const version = pkg.version;
const win = process.platform === 'win32';

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};
// Throws instead of exiting, so the finally block below still deletes mcp-publisher.
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: win, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} exited with ${r.status}`);
};
for (const ev of ['uncaughtException', 'unhandledRejection']) process.on(ev, (e) => fail(e?.message ?? String(e)));
const capture = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { cwd: root, encoding: 'utf8', shell: win, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

// 1. Versions agree.
if (server.version !== version || server.packages?.[0]?.version !== version) {
  fail(`server.json says ${server.version} / ${server.packages?.[0]?.version}, package.json says ${version}`);
}
if (server.name !== pkg.mcpName) fail(`server.json name ${server.name} != package.json mcpName ${pkg.mcpName}`);
console.log(`✓ ${pkg.name}@${version} (${server.name})`);

// 2. The package folder is committed, so the published code is in git.
const dirty = capture('git', ['status', '--porcelain', '--', '.']);
if (dirty) fail(`uncommitted changes in packages/mcp-server:\n${dirty}`);
console.log(`✓ committed at ${capture('git', ['rev-parse', '--short', 'HEAD'])}`);

// 3. What is already out there.
const onNpm = capture('npm', ['view', `${pkg.name}@${version}`, 'version']) === version;
const res = await fetch(`https://registry.modelcontextprotocol.io/v0/servers?search=${encodeURIComponent(server.name)}`);
const listed = res.ok ? ((await res.json()).servers ?? []).map((s) => s.server.version) : [];
const onRegistry = listed.includes(version);
console.log(`  npm: ${onNpm ? 'already has' : 'missing'} ${version}; latest ${capture('npm', ['view', pkg.name, 'version']) || '?'}`);
console.log(`  registry: ${onRegistry ? 'already has' : 'missing'} ${version}; versions ${listed.join(', ') || '?'}`);
if (onNpm && onRegistry) {
  console.log('Nothing to publish.');
  process.exit(0);
}

if (!publish) {
  console.log('\nChecks passed. Run again with --publish to release.');
  process.exit(0);
}

// 4. npm first: the registry checks that the npm package exists and declares mcpName.
if (!onNpm) {
  if (!capture('npm', ['whoami'])) run('npm', ['login']);
  run('npm', ['publish']);
}

// 5. Official MCP registry with a throwaway mcp-publisher. The registry checks npm, which can take a few minutes to
// show a new version.
if (!onRegistry) {
  for (let i = 0; capture('npm', ['view', `${pkg.name}@${version}`, 'version']) !== version; i++) {
    if (i === 30) fail(`npm still does not show ${version} after 10 minutes; run this script again later`);
    if (i === 0) console.log(`  waiting for npm to show ${version}...`);
    await new Promise((r) => setTimeout(r, 20_000));
  }
  const os = { win32: 'windows', darwin: 'darwin', linux: 'linux' }[process.platform];
  const arch = { x64: 'amd64', arm64: 'arm64' }[process.arch];
  if (!os || !arch) fail(`no mcp-publisher build for ${process.platform}/${process.arch}`);
  const dir = mkdtempSync(join(tmpdir(), 'mcp-publisher-'));
  try {
    const url = `https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_${os}_${arch}.tar.gz`;
    const dl = await fetch(url);
    if (!dl.ok) throw new Error(`download failed (${dl.status}): ${url}`);
    writeFileSync(join(dir, 'mcp-publisher.tar.gz'), Buffer.from(await dl.arrayBuffer()));
    run('tar', ['-xzf', 'mcp-publisher.tar.gz'], { cwd: dir, shell: false });
    const bin = join(dir, win ? 'mcp-publisher.exe' : 'mcp-publisher');
    run(bin, ['login', 'github'], { shell: false });
    run(bin, ['publish'], { shell: false });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(`\n✓ released ${version}. Smithery is not updated by this script (self-service updates are closed).`);

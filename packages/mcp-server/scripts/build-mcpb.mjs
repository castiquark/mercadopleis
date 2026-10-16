// Builds mercadopleis.mcpb (MCP Bundle) for Smithery and one-click install in MCP clients.
//   pnpm --filter @mercadopleis/mcp-server build && node scripts/build-mcpb.mjs
// Stages dist/ plus production dependencies (installed with npm, flat node_modules) next to the manifest,
// then packs it with the official mcpb CLI.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stage = join(root, '.mcpb-stage');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(root, 'mcpb', 'manifest.json'), 'utf8'));
if (manifest.version !== pkg.version) throw new Error(`manifest version ${manifest.version} != package ${pkg.version}`);

rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, 'server'), { recursive: true });
cpSync(join(root, 'dist'), join(stage, 'server', 'dist'), { recursive: true });
writeFileSync(
  join(stage, 'server', 'package.json'),
  JSON.stringify({ name: pkg.name, version: pkg.version, type: pkg.type, dependencies: pkg.dependencies }, null, 2)
);
execSync('npm install --omit=dev --no-audit --no-fund --ignore-scripts', { cwd: join(stage, 'server'), stdio: 'inherit' });
cpSync(join(root, 'mcpb', 'manifest.json'), join(stage, 'manifest.json'));
cpSync(join(root, 'README.md'), join(stage, 'README.md'));
cpSync(join(root, 'LICENSE'), join(stage, 'LICENSE'));

execSync(`npx -y @anthropic-ai/mcpb pack "${stage}" "${join(root, 'mercadopleis.mcpb')}"`, { stdio: 'inherit' });
rmSync(stage, { recursive: true, force: true });
console.log('Built mercadopleis.mcpb');

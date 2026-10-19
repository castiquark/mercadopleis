import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildWellKnown, serialize } from '../../scripts/gen-well-known.mjs';

const publicDir = join(__dirname, '../../public/.well-known');
const mcpPkg = JSON.parse(readFileSync(join(__dirname, '../../../../packages/mcp-server/package.json'), 'utf8'));

describe('/.well-known discovery files', () => {
  it('match packages/mcp-server (run pnpm --filter @mercadopleis/web gen:well-known after an MCP release)', () => {
    for (const [file, value] of Object.entries(buildWellKnown())) {
      expect(readFileSync(join(publicDir, file), 'utf8').replace(/\r\n/g, '\n'), file).toBe(serialize(value));
    }
  });

  it('describe the npm stdio server only, with the published version', () => {
    const mcp = buildWellKnown()['mcp.json'];
    expect(mcp.version).toBe(mcpPkg.version);
    expect(mcp.packages).toEqual([expect.objectContaining({ registryType: 'npm', identifier: mcpPkg.name, version: mcpPkg.version, transport: { type: 'stdio' } })]);
    expect(mcp.remotes).toBeUndefined();
  });

  it('is a valid A2A card that claims no A2A endpoint', () => {
    const card = buildWellKnown()['agent-card.json'];
    for (const key of ['name', 'description', 'supportedInterfaces', 'version', 'capabilities', 'defaultInputModes', 'defaultOutputModes', 'skills']) {
      expect(card, key).toHaveProperty(key);
    }
    expect(card.supportedInterfaces).toEqual([]);
    for (const skill of card.skills) expect(Object.keys(skill)).toEqual(expect.arrayContaining(['id', 'name', 'description', 'tags']));
    expect(JSON.stringify(card).length).toBeLessThan(10_000);
  });
});

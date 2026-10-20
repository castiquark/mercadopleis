#!/usr/bin/env node
// stdio entry point: one process per agent, as started by npx @mercadopleis/mcp-server.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

await createServer().connect(new StdioServerTransport());

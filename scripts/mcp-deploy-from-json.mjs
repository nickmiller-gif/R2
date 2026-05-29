#!/usr/bin/env node
/**
 * Reads a deploy_edge_function payload JSON and prints it for MCP invocation.
 * Usage: node scripts/mcp-deploy-from-json.mjs /tmp/eigen-chat-deploy.json
 */
import fs from 'node:fs';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/mcp-deploy-from-json.mjs <deploy-json-path>');
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(path, 'utf8'));
const { project_id, name, entrypoint_path, verify_jwt, files } = payload;
if (!project_id || !name || !entrypoint_path || verify_jwt === undefined || !Array.isArray(files)) {
  console.error('Invalid deploy payload: missing required fields');
  process.exit(1);
}

// Emit compact JSON for MCP deploy_edge_function arguments
process.stdout.write(JSON.stringify({ project_id, name, entrypoint_path, verify_jwt, files }));

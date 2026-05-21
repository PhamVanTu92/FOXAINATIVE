#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PROTO_DIR = join(ROOT, 'proto');
const OUT_DIR = join(ROOT, 'gen', 'ts');

mkdirSync(OUT_DIR, { recursive: true });

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (name.endsWith('.proto')) acc.push(p);
  }
  return acc;
}

const files = walk(PROTO_DIR);
if (files.length === 0) {
  console.error('No .proto files found under', PROTO_DIR);
  process.exit(1);
}

const tsProtoPlugin =
  process.platform === 'win32'
    ? '.\\node_modules\\.bin\\protoc-gen-ts_proto.cmd'
    : './node_modules/.bin/protoc-gen-ts_proto';

const args = [
  `--plugin=${tsProtoPlugin}`,
  `--ts_proto_out=${OUT_DIR}`,
  '--ts_proto_opt=outputServices=grpc-js,esModuleInterop=true,useOptionals=messages,env=node',
  `--proto_path=${PROTO_DIR}`,
  ...files,
];

const cmd = `protoc ${args.join(' ')}`;
console.log('Running:', cmd);

try {
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
  console.log('TypeScript stubs generated at', OUT_DIR);
} catch (err) {
  console.error('protoc failed. Ensure `protoc` (Protocol Buffers compiler) is installed and on PATH.');
  console.error('See: https://grpc.io/docs/protoc-installation/');
  process.exit(1);
}

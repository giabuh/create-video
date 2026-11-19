// One-time: build whisper.cpp and download the model into .whisper/ (git-ignored), via Remotion's installer.
// Usage: node tools/whisper/setup.mjs            (reads config.json "align": {version, model})
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {downloadWhisperModel, installWhisperCpp} from '@remotion/install-whisper-cpp';

const root = path.resolve(import.meta.dirname, '../..');
const a = JSON.parse(readFileSync(path.join(root, 'config.json'), 'utf8')).align ?? {};
const version = a.version ?? '1.9.5', model = a.model ?? 'large-v3-turbo';
const dir = path.join(root, '.whisper', 'whisper.cpp');
console.log(`whisper.cpp ${version} -> ${dir}`);
await installWhisperCpp({version, to: dir, printOutput: true});
console.log(`model ${model}`);
await downloadWhisperModel({model, folder: dir, printOutput: true});
console.log('whisper ready');

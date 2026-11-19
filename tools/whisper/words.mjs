// Word timestamps for one 16 kHz mono wav, printed as one JSON line: [{"w","start","end"}] (seconds).
// Usage: node tools/whisper/words.mjs <in16k.wav> <model> <whisperVersion> <language>
import path from 'node:path';
import {toCaptions, transcribe} from '@remotion/install-whisper-cpp';

const [input, model, version, language] = process.argv.slice(2);
const dir = path.resolve(import.meta.dirname, '../../.whisper/whisper.cpp');
const out = await transcribe({
  inputPath: input, whisperPath: dir, whisperCppVersion: version, model, modelFolder: dir,
  tokenLevelTimestamps: true, language, printOutput: false, splitOnWord: true,
});
const {captions} = toCaptions({whisperCppOutput: out});
const words = captions.map((c) => ({w: c.text.trim(), start: c.startMs / 1000, end: c.endMs / 1000})).filter((x) => x.w);
console.log(JSON.stringify(words));

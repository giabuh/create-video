#!/usr/bin/env node
// Test double for `codex exec --json`. Behaviour is picked by words in the prompt: LIMIT, NOTHREAD.
import {randomUUID} from 'node:crypto';

const args = process.argv.slice(2);
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n');
let prompt = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { prompt += d; });
process.stdin.on('end', () => { run(); });

function run() {
  const resume = args[0] === 'exec' && args[1] === 'resume';
  const thread = resume ? args[args.length - 2] : randomUUID();
  if (resume && prompt.includes('NOTHREAD')) {
    process.stderr.write(`Error: thread/resume: thread/resume failed: no rollout found for thread id ${thread} (code -32600)\n`);
    process.exit(1);
  }
  out({type: 'thread.started', thread_id: thread});
  out({type: 'turn.started'});
  if (prompt.includes('LIMIT')) {
    out({type: 'error', message: "You've hit your usage limit."});
    out({type: 'turn.failed', error: {message: "You've hit your usage limit."}});
    process.exit(1);
  }
  const pick = (f, pre) => { const i = args.findIndex((a, j) => args[j - 1] === f && a.startsWith(pre)); return i < 0 ? '' : ` ${f}=${args[i].slice(pre.length)}`; };
  const c = args.indexOf('-c');
  const dev = c >= 0 && args[c + 1].startsWith('developer_instructions=') ? 'yes' : 'no';
  const reply = `engine=codex mode=${resume ? 'resume' : 'new'} thread=${thread} dev=${dev}${pick('-m', '')}${pick('-c', 'model_reasoning_effort=')} prompt=${prompt.trim()}`;
  const cmd = "/bin/bash -lc 'ls projects'";
  out({type: 'item.started', item: {id: 'item_0', type: 'command_execution', command: cmd, aggregated_output: '', exit_code: null, status: 'in_progress'}});
  out({type: 'item.completed', item: {id: 'item_0', type: 'command_execution', command: cmd, aggregated_output: '_smoke\n', exit_code: 0, status: 'completed'}});
  out({type: 'item.completed', item: {id: 'item_1', type: 'agent_message', text: reply}});
  out({type: 'turn.completed', usage: {input_tokens: 10, cached_input_tokens: 0, output_tokens: 5}});
}

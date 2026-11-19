#!/usr/bin/env node
// Test double for the `claude` CLI in stream-json mode. Behaviour is picked by words in the prompt (see plan Task 3).
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let prompt = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { prompt += d; });
process.stdin.on('end', () => { void run(); });

async function run() {
  const resume = flag('--resume');
  const sid = resume ?? flag('--session-id');
  const mode = resume ? 'resume' : 'new';
  if (prompt.includes('NOSESSION') && resume) {
    out({type: 'result', subtype: 'error_during_execution', is_error: true, errors: [`No conversation found with session ID: ${sid}`]});
    process.exit(1);
  }
  out({type: 'system', subtype: 'init', session_id: sid});
  if (prompt.includes('CRASH')) { process.stderr.write('boom: fake crash\n'); process.exit(3); }
  if (prompt.includes('HARDLIMIT')) { // limit event, then exit without a result line
    out({type: 'rate_limit_event', rate_limit_info: {status: 'rejected', resetsAt: 1795514400, rateLimitType: 'five_hour', utilization: 1}});
    process.stderr.write('usage limit reached\n'); process.exit(1);
  }
  if (prompt.includes('LIMIT')) {
    out({type: 'rate_limit_event', rate_limit_info: {status: 'rejected', resetsAt: 1795514400, rateLimitType: 'five_hour', utilization: 1}});
    out({type: 'result', subtype: 'success', is_error: true, result: "You've hit your limit", api_error_status: 429});
    return;
  }
  if (prompt.includes('SLOW')) {
    for (let i = 0; i < 300; i++) { out({type: 'stream_event', parent_tool_use_id: null, event: {type: 'content_block_delta', delta: {type: 'text_delta', text: `${i} `}}}); await sleep(200); }
    return;
  }
  const acc = process.env.CLAUDE_CONFIG_DIR ? path.basename(process.env.CLAUDE_CONFIG_DIR) : 'default';
  const reply = `acc=${acc} mode=${mode} sys=${flag('--append-system-prompt') ? 'yes' : 'no'} prompt=${prompt.trim()}`;
  for (const w of reply.split(/(?<= )/)) { out({type: 'stream_event', parent_tool_use_id: null, event: {type: 'content_block_delta', delta: {type: 'text_delta', text: w}}}); await sleep(5); }
  out({type: 'assistant', parent_tool_use_id: null, message: {content: [{type: 'text', text: reply}]}});
  out({type: 'assistant', parent_tool_use_id: null, message: {content: [{type: 'tool_use', id: 't1', name: 'Bash', input: {command: 'ls projects'}}]}});
  out({type: 'result', subtype: 'success', is_error: false, result: reply, total_cost_usd: 0.01, duration_ms: 1234});
}

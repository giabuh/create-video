import {readFileSync} from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {parseLine, toolSummary} from './stream.ts';

const lines = readFileSync(path.join(import.meta.dirname, 'fixtures/turn.jsonl'), 'utf8').split('\n').filter(Boolean);
const all = lines.map(parseLine);

describe('parseLine', () => {
  it('maps a full turn', () => {
    expect(all.flatMap(p => p!.events)).toEqual([
      {kind: 'delta', text: 'Xin '},
      {kind: 'delta', text: 'chào'},
      {kind: 'text', text: 'Xin chào'},
      {kind: 'tool', name: 'Bash', summary: 'python3 tools/prepare.py projects/a --json'},
    ]); // subagent delta/text (parent_tool_use_id set), thinking, hooks and tool results are dropped
    expect(all.filter(p => p!.init)).toHaveLength(1);
    expect(all.find(p => p!.limit)!.limit).toEqual({status: 'allowed_warning', resetsAt: 1795514400, utilization: 0.56, type: 'seven_day'});
    expect(all.at(-1)!.result).toEqual({isError: false, message: 'Xin chào', costUsd: 0.0077, durationMs: 1234, http429: false});
  });
  it('error results', () => {
    expect(parseLine('{"type":"result","subtype":"error_during_execution","is_error":true,"errors":["No conversation found with session ID: x"]}')!.result)
      .toEqual({isError: true, message: 'No conversation found with session ID: x', costUsd: null, durationMs: null, http429: false});
    expect(parseLine('{"type":"result","subtype":"success","is_error":true,"result":"You\'ve hit your limit","api_error_status":429}')!.result!.http429).toBe(true);
  });
  it('rejects non-objects', () => {
    expect(parseLine('not json')).toBeNull();
    expect(parseLine('[1]')).toBeNull();
    expect(parseLine('{"type":"weird"}')).toEqual({events: []});
  });
  it('toolSummary picks the first useful field and truncates', () => {
    expect(toolSummary({file_path: 'projects/x/storyboard.json', old_string: 'a'})).toBe('projects/x/storyboard.json');
    expect(toolSummary({foo: 1})).toBe('');
    expect(toolSummary({command: 'x'.repeat(100)})).toBe('x'.repeat(79) + '…');
  });
});

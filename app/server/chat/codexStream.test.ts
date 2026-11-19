import {readFileSync} from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {parseCodexLine, shellCommand} from './codexStream.ts';

const lines = readFileSync(path.join(import.meta.dirname, 'fixtures/codex-turn.jsonl'), 'utf8').split('\n').filter(Boolean);

describe('parseCodexLine', () => {
  it('maps the captured turn', () => {
    const all = lines.map(parseCodexLine);
    expect(all[0]).toEqual({events: [], init: true, threadId: '01a1f20b-c273-7340-b1d8-e82e51082ee7'});
    expect(all[1]).toEqual({events: []});
    expect(all[2]?.events).toEqual([{kind: 'text', text: 'Running the command.'}]);
    expect(all[3]?.events).toEqual([{kind: 'tool', name: 'Bash', summary: 'ls tools | head -3'}]);
    expect(all[4]?.events).toEqual([]); // completed command already shown on start
    expect(all[5]?.events).toEqual([{kind: 'text', text: 'done'}]);
    expect(all[6]?.result).toEqual({isError: false, message: null, costUsd: null, durationMs: null, http429: false});
    expect(all[7]?.events).toEqual([]);
    expect(all[8]?.events).toEqual([{kind: 'tool', name: 'Edit', summary: 'projects/x/storyboard.json, config.json'}]);
    expect(all[9]?.events).toEqual([{kind: 'tool', name: 'Search', summary: 'remotion spring'}]);
    expect(all[10]).toBeNull();
  });
  it('turn.failed → error result; limit text → rejected limit', () => {
    const r = parseCodexLine(JSON.stringify({type: 'turn.failed', error: {message: "You've hit your usage limit."}}));
    expect(r?.result).toEqual({isError: true, message: "You've hit your usage limit.", costUsd: null, durationMs: null, http429: false});
    expect(r?.limit).toEqual({status: 'rejected', resetsAt: null, utilization: null, type: null});
    expect(parseCodexLine(JSON.stringify({type: 'turn.failed', error: {message: 'boom'}}))?.limit).toBeUndefined();
  });
  it('error event is a non-terminal note', () => {
    const r = parseCodexLine(JSON.stringify({type: 'error', message: 'Reconnecting... 1/5'}));
    expect(r).toEqual({events: [], note: 'Reconnecting... 1/5'});
  });
  it('rejects a thread id that is not uuid-shaped', () => {
    expect(parseCodexLine(JSON.stringify({type: 'thread.started', thread_id: '--yolo'}))).toEqual({events: []});
  });
  it('shellCommand unwraps bash -lc', () => {
    expect(shellCommand("/bin/bash -lc 'echo '\\''hi'\\'''")).toBe("echo 'hi'");
    expect(shellCommand('ls')).toBe('ls');
  });
});

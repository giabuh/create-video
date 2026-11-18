import {describe, expect, it} from 'vitest';
import {parseLastJsonLine} from './procs.ts';

describe('parseLastJsonLine', () => {
  it('returns the last object line', () => {
    expect(parseLastJsonLine('warn\n{"a":1}\n{"ok":true}\n\n')).toEqual({ok: true});
    expect(parseLastJsonLine('{"ok":false}\n[1]\n"s"\ntrailing')).toEqual({ok: false});
  });
  it('throws a readable error when none', () => {
    expect(() => parseLastJsonLine('Traceback\nValueError')).toThrow(/no JSON object/);
    expect(() => parseLastJsonLine('')).toThrow(/no JSON object/);
  });
});

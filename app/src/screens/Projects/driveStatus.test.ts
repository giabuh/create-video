import {describe, expect, it} from 'vitest';
import type {DriveStatus} from '../../../shared/types.ts';
import {driveRow} from './driveStatus.ts';

const d = (p: Partial<DriveStatus>): DriveStatus => ({checkedAt: 1, error: null, versions: {}, orphans: [], ...p});
describe('driveRow', () => {
  it('maps status', () => {
    expect(driveRow(undefined, 'a')).toBe('checking');
    expect(driveRow(d({error: 'x'}), 'a')).toBe('unknown');
    expect(driveRow(d({versions: {a: 'ok'}}), 'a')).toBe('ok');
    expect(driveRow(d({versions: {a: 'mismatch'}}), 'a')).toBe('missing');
    expect(driveRow(d({versions: {a: 'missing'}}), 'a')).toBe('missing');
    expect(driveRow(d({}), 'a')).toBe('missing');
  });
});

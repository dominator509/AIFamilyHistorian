import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('local infrastructure', () => {
  it('passes the repository connectivity sentinel', () => {
    const output = execFileSync('sh', ['scripts/local-services-check.sh'], { encoding: 'utf8' });
    expect(output.trim()).toBe('local services: ok');
  });
});

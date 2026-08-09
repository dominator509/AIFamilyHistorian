import { describe, expect, it } from 'vitest';
import { assertWorkerSandboxSnapshot } from '../../apps/worker/src/sandbox.js';

const mountInfo = [
  '1 1 0:1 / / ro,relatime - ext4 /dev/root ro',
  '2 1 0:2 / /tmp rw,nosuid,noexec,relatime - tmpfs tmpfs rw,size=1073741824',
].join('\n');

const validSnapshot = {
  procStatus: ['NoNewPrivs:\t1', 'CapEff:\t0000000000000000', 'Seccomp:\t2'].join('\n'),
  mountInfo,
  pidsMax: '256',
  memoryMax: '2147483648',
  cpuMax: '200000 100000',
};

describe('worker runtime sandbox gate', () => {
  it('accepts a bounded, privilege-reduced Linux snapshot', () => {
    expect(() => assertWorkerSandboxSnapshot(validSnapshot)).not.toThrow();
  });

  it.each([
    ['NoNewPrivs: 0', 'worker sandbox requires no-new-privileges'],
    ['CapEff:\t0000000000000001', 'worker sandbox requires all effective capabilities dropped'],
    ['Seccomp:\t0', 'worker sandbox requires a seccomp filter'],
  ])('fails closed when %s', (statusLine, message) => {
    expect(() =>
      assertWorkerSandboxSnapshot({
        ...validSnapshot,
        procStatus: validSnapshot.procStatus
          .split('\n')
          .map((line) => (line.split(':')[0] === statusLine.split(':')[0] ? statusLine : line))
          .join('\n'),
      }),
    ).toThrow(message);
  });

  it('fails closed when scratch or cgroup limits are missing', () => {
    expect(() =>
      assertWorkerSandboxSnapshot({
        ...validSnapshot,
        mountInfo: validSnapshot.mountInfo.replace('noexec', 'exec'),
      }),
    ).toThrow('worker sandbox requires noexec scratch storage');
    expect(() => assertWorkerSandboxSnapshot({ ...validSnapshot, pidsMax: 'max' })).toThrow(
      'worker sandbox requires a bounded PID cgroup',
    );
    expect(() => assertWorkerSandboxSnapshot({ ...validSnapshot, cpuMax: 'max 100000' })).toThrow(
      'worker sandbox requires a bounded CPU cgroup',
    );
  });
});

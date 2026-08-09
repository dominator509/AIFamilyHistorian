import { readFile as readFileFromDisk } from 'node:fs/promises';

export interface WorkerSandboxSnapshot {
  readonly procStatus: string;
  readonly mountInfo: string;
  readonly pidsMax: string;
  readonly memoryMax: string;
  readonly cpuMax: string;
}

export type SandboxFileReader = (path: string) => Promise<string>;

/**
 * Validate the kernel controls that are observable from inside the worker.
 * Production workers fail closed when a platform deploy omits these controls;
 * the external signed attestation remains required for egress and deployment
 * identity because those properties cannot be proven from process-local state.
 */
export function assertWorkerSandboxSnapshot(snapshot: WorkerSandboxSnapshot): void {
  if (!/^NoNewPrivs:\s*1\s*$/mu.test(snapshot.procStatus))
    throw new Error('worker sandbox requires no-new-privileges');
  const capabilities = /^CapEff:\s*([0-9a-f]+)\s*$/imu.exec(snapshot.procStatus)?.[1];
  if (!capabilities || /[1-9a-f]/iu.test(capabilities))
    throw new Error('worker sandbox requires all effective capabilities dropped');
  if (!/^Seccomp:\s*2\s*$/mu.test(snapshot.procStatus))
    throw new Error('worker sandbox requires a seccomp filter');

  const rootOptions = mountOptions(snapshot.mountInfo, '/');
  if (!rootOptions.has('ro'))
    throw new Error('worker sandbox requires a read-only root filesystem');

  const scratchOptions = mountOptions(snapshot.mountInfo, '/tmp');
  for (const option of ['noexec', 'nosuid']) {
    if (!scratchOptions.has(option))
      throw new Error(`worker sandbox requires ${option} scratch storage`);
  }

  const pidsLimit = parseBoundedInteger(snapshot.pidsMax, 1, 4096);
  if (pidsLimit === null) throw new Error('worker sandbox requires a bounded PID cgroup');
  const memoryLimit = parseBoundedInteger(snapshot.memoryMax, 1, 8 * 1024 ** 3);
  if (memoryLimit === null) throw new Error('worker sandbox requires a bounded memory cgroup');
  const [quota, period] = snapshot.cpuMax.trim().split(/\s+/u);
  if (
    !quota ||
    !period ||
    quota === 'max' ||
    !/^\d+$/u.test(quota) ||
    !/^\d+$/u.test(period) ||
    Number(quota) < 1 ||
    Number(period) < 1 ||
    Number(quota) / Number(period) > 4
  )
    throw new Error('worker sandbox requires a bounded CPU cgroup');
}

export async function assertWorkerSandbox(
  readFile: SandboxFileReader = (path) => readFileFromDisk(path, 'utf8'),
): Promise<void> {
  if (process.platform !== 'linux')
    throw new Error('production worker sandbox checks require Linux');
  const [procStatus, mountInfo, pidsMax, memoryMax, cpuMax] = await Promise.all([
    readFile('/proc/self/status'),
    readFile('/proc/self/mountinfo'),
    readFile('/sys/fs/cgroup/pids.max'),
    readFile('/sys/fs/cgroup/memory.max'),
    readFile('/sys/fs/cgroup/cpu.max'),
  ]);
  assertWorkerSandboxSnapshot({ procStatus, mountInfo, pidsMax, memoryMax, cpuMax });
}

function mountOptions(mountInfo: string, mountPoint: string): Set<string> {
  for (const line of mountInfo.split(/\r?\n/u)) {
    const fields = line.split(' ');
    const separator = fields.indexOf('-');
    if (separator < 6 || fields[4] !== mountPoint) continue;
    const options = new Set<string>();
    for (const value of `${fields[5] ?? ''},${fields[separator + 3] ?? ''}`.split(',')) {
      if (value) options.add(value);
    }
    return options;
  }
  return new Set();
}

function parseBoundedInteger(value: string, minimum: number, maximum: number): number | null {
  const normalized = value.trim();
  if (!/^\d+$/u.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

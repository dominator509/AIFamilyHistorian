import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('worker OS sandbox declaration', () => {
  it('declares bounded resources and privilege reduction in local compose', async () => {
    const compose = await readFile('compose.yaml', 'utf8');
    expect(compose).toContain("profiles: ['worker']");
    expect(compose).toContain('read_only: true');
    expect(compose).toContain("cap_drop: ['ALL']");
    expect(compose).toContain('no-new-privileges:true');
    expect(compose).toContain('pids_limit: 256');
    expect(compose).toContain('mem_limit: 2g');
    expect(compose).toContain('cpus: 2.0');
    expect(compose).toContain('/tmp:rw,noexec,nosuid,size=1g');
    expect(compose).toContain('networks: [family_historian_internal]');
    expect(compose).toContain('family_historian_internal:\n    internal: true');
  });

  it('declares bounded VM resources and graceful termination for Fly worker', async () => {
    const fly = await readFile('fly.worker.toml', 'utf8');
    expect(fly).toContain('cpus = 2');
    expect(fly).toContain('memory = "2048mb"');
    expect(fly).toContain('signal = "SIGTERM"');
    expect(fly).toContain('timeout = "30s"');
    expect(fly).not.toContain('[http_service]');
    expect(fly).not.toContain('[[services]]');
  });
});

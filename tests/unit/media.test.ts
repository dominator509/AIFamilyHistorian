import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import {
  assertOriginalImmutable,
  buildMediaPipelinePlan,
  executeMediaPipelineStep,
  MediaPipelineError,
  transitionQuarantine,
  validateMediaDescriptor,
} from '../../packages/media/src/index.js';
import type { MediaExecutionError } from '../../packages/media/src/index.js';

const descriptor = {
  id: '01900000-0000-7000-8000-000000000021',
  objectKey: 'org/archive/originals/asset-1',
  contentType: 'audio/wav',
  byteSize: 1024,
  sha256Hex: 'a'.repeat(64),
  kind: 'audio' as const,
};

describe('media pipeline boundaries', () => {
  it('builds a bounded argv plan without shell interpolation', () => {
    const plan = buildMediaPipelinePlan(descriptor);
    expect(plan.map((step) => step.name)).toEqual([
      'malware-scan',
      'metadata-probe',
      'waveform-derivative',
    ]);
    for (const step of plan) {
      expect(step.args.join(' ')).not.toMatch(/[;&|`$]/u);
      expect(step.timeoutSeconds).toBeGreaterThan(0);
    }
  });

  it('fails closed for invalid quarantine transitions and original mutation', () => {
    expect(transitionQuarantine('pending', 'scanning')).toBe('scanning');
    expect(transitionQuarantine('scanning', 'infected')).toBe('infected');
    expect(() => transitionQuarantine('clean', 'scanning')).toThrow(MediaPipelineError);
    expect(() =>
      assertOriginalImmutable(descriptor, { ...descriptor, sha256Hex: 'b'.repeat(64) }),
    ).toThrow('fixity is immutable');
  });

  it('rejects traversal and mismatched media kinds', () => {
    expect(() => validateMediaDescriptor({ ...descriptor, objectKey: '../escape' })).toThrow();
    expect(() => validateMediaDescriptor({ ...descriptor, kind: 'video' })).toThrow(
      'media kind does not match',
    );
  });

  it('executes an argv-only step with bounded output and object-key resolution', async () => {
    const step = {
      name: 'test-step',
      tool: 'ffprobe' as const,
      args: ['-e', "process.stdout.write('ok')", 'opaque/input', 'opaque/output'],
      timeoutSeconds: 2,
      inputObjectKey: 'opaque/input',
      outputObjectKey: 'opaque/output',
    };
    const result = await executeMediaPipelineStep(step, {
      cwd: process.cwd(),
      binaries: { ffprobe: process.execPath },
      resolveObjectKey: (key) => join(process.cwd(), 'scratch', key.split('/').at(-1)!),
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('ok');
    expect(result.args).toContain(join(process.cwd(), 'scratch', 'input'));
    expect(result.args).toContain(join(process.cwd(), 'scratch', 'output'));
  });

  it('does not inherit provider secrets into media subprocesses', async () => {
    const previous = process.env.DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_API_KEY = 'secret-that-must-not-cross-media-boundary';
    try {
      const result = await executeMediaPipelineStep(
        {
          name: 'env-boundary',
          tool: 'ffprobe',
          args: [
            '-e',
            "process.stdout.write(process.env.DEEPSEEK_API_KEY ?? 'absent')",
            'opaque/input',
          ],
          timeoutSeconds: 2,
          inputObjectKey: 'opaque/input',
        },
        {
          cwd: process.cwd(),
          binaries: { ffprobe: process.execPath },
          resolveObjectKey: (key) => join(process.cwd(), 'scratch', key.split('/').at(-1)!),
        },
      );
      expect(result.stdout).toBe('absent');
    } finally {
      if (previous === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = previous;
    }
  });

  it('maps unavailable and timed-out tools to fail-closed errors', async () => {
    const base = {
      name: 'test-step',
      tool: 'ffprobe' as const,
      args: ['-e', "process.stdout.write('ok')", 'opaque/input'],
      timeoutSeconds: 1,
      inputObjectKey: 'opaque/input',
    };
    await expect(
      executeMediaPipelineStep(base, {
        cwd: process.cwd(),
        binaries: { ffprobe: 'media-tool-not-installed-for-test' },
        resolveObjectKey: (key) => join(process.cwd(), 'scratch', key.split('/').at(-1)!),
      }),
    ).rejects.toMatchObject<MediaExecutionError>({ code: 'MEDIA_TOOL_UNAVAILABLE' });

    await expect(
      executeMediaPipelineStep(
        { ...base, args: ['-e', 'setTimeout(() => {}, 5000)', 'opaque/input'] },
        {
          cwd: process.cwd(),
          binaries: { ffprobe: process.execPath },
          resolveObjectKey: (key) => join(process.cwd(), 'scratch', key.split('/').at(-1)!),
        },
      ),
    ).rejects.toMatchObject<MediaExecutionError>({ code: 'MEDIA_TOOL_TIMEOUT' });
  });

  it('rejects worker paths that escape the scratch directory', async () => {
    await expect(
      executeMediaPipelineStep(
        {
          name: 'escape-test',
          tool: 'ffprobe',
          args: ['opaque/input'],
          timeoutSeconds: 1,
          inputObjectKey: 'opaque/input',
        },
        {
          cwd: process.cwd(),
          binaries: { ffprobe: process.execPath },
          resolveObjectKey: () => '..',
        },
      ),
    ).rejects.toMatchObject<MediaExecutionError>({ code: 'MEDIA_TOOL_INVALID' });
  });
});

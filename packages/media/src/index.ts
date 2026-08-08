import { spawn } from 'node:child_process';
import { isAbsolute, relative, resolve as resolvePath, sep } from 'node:path';
import type { EntityId } from '@family-historian/contracts';
import { uuidSchema } from '@family-historian/contracts';
import { z } from 'zod';

export const MAX_MEDIA_BYTES = 25 * 1024 * 1024 * 1024;

export type MediaKind = 'image' | 'document' | 'audio' | 'video';
export type QuarantineStatus = 'pending' | 'scanning' | 'clean' | 'infected' | 'error';

export interface MediaDescriptor {
  readonly id: EntityId;
  readonly objectKey: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly sha256Hex: string;
  readonly kind: MediaKind;
}

export interface PipelineStep {
  readonly name: string;
  readonly tool: 'clamscan' | 'ffprobe' | 'ffmpeg' | 'exiftool' | 'magick' | 'ocrmypdf';
  readonly args: readonly string[];
  readonly timeoutSeconds: number;
  readonly inputObjectKey: string;
  readonly outputObjectKey?: string;
}

export interface MediaToolExecutionOptions {
  /** Absolute scratch directory owned by the media worker. */
  readonly cwd: string;
  /** Resolve opaque object keys into worker-local paths before execution. */
  readonly resolveObjectKey: (objectKey: string) => string;
  /** Override binaries for a pinned worker image or deterministic test process. */
  readonly binaries?: Partial<Record<PipelineStep['tool'], string>>;
  readonly env?: NodeJS.ProcessEnv;
  readonly maxOutputBytes?: number;
}

export interface MediaToolExecutionResult {
  readonly tool: PipelineStep['tool'];
  readonly binary: string;
  readonly args: readonly string[];
  readonly exitCode: number;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
}

const descriptorSchema = z.object({
  id: uuidSchema,
  objectKey: z
    .string()
    .min(1)
    .max(512)
    .refine((value) => !value.includes('..'), 'object key traversal'),
  contentType: z.string().regex(/^[\w.-]+\/[\w.+-]+$/u),
  byteSize: z.number().int().positive().max(MAX_MEDIA_BYTES),
  sha256Hex: z.string().regex(/^[a-f0-9]{64}$/u),
  kind: z.enum(['image', 'document', 'audio', 'video']),
});

const contentTypeKinds: readonly [RegExp, MediaKind][] = [
  [/^image\//u, 'image'],
  [/^video\//u, 'video'],
  [/^audio\//u, 'audio'],
  [
    /^(?:application\/pdf|text\/|application\/vnd\.oasis\.opendocument\.|application\/msword)/u,
    'document',
  ],
];

export function validateMediaDescriptor(input: MediaDescriptor): MediaDescriptor {
  const parsed = descriptorSchema.parse(input);
  const inferred = inferMediaKind(parsed.contentType);
  if (inferred !== undefined && inferred !== parsed.kind)
    throw new MediaPipelineError('media kind does not match content type');
  return Object.freeze(parsed);
}

export function inferMediaKind(contentType: string): MediaKind | undefined {
  return contentTypeKinds.find(([pattern]) => pattern.test(contentType))?.[1];
}

function startsWithBytes(input: Uint8Array, expected: readonly number[], offset = 0): boolean {
  return expected.every((value, index) => input[offset + index] === value);
}

function isUtf8Text(input: Uint8Array): boolean {
  if (input.includes(0)) return false;
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(input);
    return decoded.trim().length > 0;
  } catch {
    return false;
  }
}

/** Infer a MIME type from bounded magic bytes; never reads or buffers the full object. */
export function sniffContentType(prefix: Uint8Array): string | undefined {
  if (startsWithBytes(prefix, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWithBytes(prefix, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (
    startsWithBytes(prefix, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    startsWithBytes(prefix, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  )
    return 'image/gif';
  if (
    startsWithBytes(prefix, [0x52, 0x49, 0x46, 0x46]) &&
    startsWithBytes(prefix, [0x57, 0x45, 0x42, 0x50], 8)
  )
    return 'image/webp';
  if (
    startsWithBytes(prefix, [0x52, 0x49, 0x46, 0x46]) &&
    startsWithBytes(prefix, [0x57, 0x41, 0x56, 0x45], 8)
  )
    return 'audio/wav';
  if (
    startsWithBytes(prefix, [0x49, 0x44, 0x33]) ||
    (prefix[0] === 0xff && (prefix[1]! & 0xe0) === 0xe0)
  )
    return 'audio/mpeg';
  if (startsWithBytes(prefix, [0x4f, 0x67, 0x67, 0x53])) return 'audio/ogg';
  if (startsWithBytes(prefix, [0x66, 0x4c, 0x61, 0x43])) return 'audio/flac';
  if (startsWithBytes(prefix, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';
  if (startsWithBytes(prefix, [0x66, 0x74, 0x79, 0x70], 4)) return 'video/mp4';
  if (startsWithBytes(prefix, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  if (startsWithBytes(prefix, [0x50, 0x4b, 0x03, 0x04])) return 'application/zip';
  if (isUtf8Text(prefix)) return 'text/plain';
  return undefined;
}

/** Return whether the declared upload type agrees with its bounded content signature. */
export function contentTypeMatchesSignature(contentType: string, prefix: Uint8Array): boolean {
  const declared = contentType.toLowerCase();
  if (declared === 'text/plain' || declared === 'text/csv' || declared === 'application/json')
    return isUtf8Text(prefix);
  const detected = sniffContentType(prefix);
  if (!detected) return false;
  if (declared === detected) return true;
  if (declared === 'audio/mp4' && detected === 'video/mp4') return true;
  if (declared === 'video/quicktime' && detected === 'video/mp4') return true;
  return false;
}

export function transitionQuarantine(
  current: QuarantineStatus,
  next: QuarantineStatus,
): QuarantineStatus {
  const allowed: Record<QuarantineStatus, readonly QuarantineStatus[]> = {
    pending: ['scanning'],
    scanning: ['clean', 'infected', 'error'],
    clean: [],
    infected: [],
    error: ['scanning'],
  };
  if (!allowed[current].includes(next))
    throw new MediaPipelineError(`invalid quarantine transition: ${current} -> ${next}`);
  return next;
}

/** Build an explicit argv plan; execution belongs to a sandboxed media worker. */
export function buildMediaPipelinePlan(descriptor: MediaDescriptor): readonly PipelineStep[] {
  const media = validateMediaDescriptor(descriptor);
  const scratch = scratchKey(media.id);
  const steps: PipelineStep[] = [
    {
      name: 'malware-scan',
      tool: 'clamscan',
      args: ['--fdpass', '--no-summary', media.objectKey],
      timeoutSeconds: 300,
      inputObjectKey: media.objectKey,
    },
  ];
  if (media.kind === 'audio' || media.kind === 'video') {
    steps.push({
      name: 'metadata-probe',
      tool: 'ffprobe',
      args: [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        media.objectKey,
      ],
      timeoutSeconds: 120,
      inputObjectKey: media.objectKey,
      outputObjectKey: `${scratch}/metadata.json`,
    });
  }
  if (media.kind === 'audio') {
    steps.push({
      name: 'waveform-derivative',
      tool: 'ffmpeg',
      args: [
        '-nostdin',
        '-i',
        media.objectKey,
        '-map_metadata',
        '-1',
        '-ac',
        '1',
        '-ar',
        '16000',
        `${scratch}/audio.wav`,
      ],
      timeoutSeconds: 900,
      inputObjectKey: media.objectKey,
      outputObjectKey: `${scratch}/audio.wav`,
    });
  }
  if (media.kind === 'video') {
    steps.push({
      name: 'playback-derivative',
      tool: 'ffmpeg',
      args: [
        '-nostdin',
        '-i',
        media.objectKey,
        '-map_metadata',
        '-1',
        '-c:v',
        'libx264',
        '-c:a',
        'aac',
        `${scratch}/playback.mp4`,
      ],
      timeoutSeconds: 1800,
      inputObjectKey: media.objectKey,
      outputObjectKey: `${scratch}/playback.mp4`,
    });
  }
  if (media.kind === 'image') {
    steps.push(
      {
        name: 'metadata-scrub',
        tool: 'exiftool',
        args: ['-json', '-S', media.objectKey],
        timeoutSeconds: 120,
        inputObjectKey: media.objectKey,
        outputObjectKey: `${scratch}/metadata.json`,
      },
      {
        name: 'thumbnail-derivative',
        tool: 'magick',
        args: [
          media.objectKey,
          '-auto-orient',
          '-strip',
          '-thumbnail',
          '1600x1600>',
          `${scratch}/thumbnail.jpg`,
        ],
        timeoutSeconds: 300,
        inputObjectKey: media.objectKey,
        outputObjectKey: `${scratch}/thumbnail.jpg`,
      },
    );
  }
  if (media.kind === 'document') {
    steps.push({
      name: 'ocr-derivative',
      tool: 'ocrmypdf',
      args: ['--skip-text', '--output-type', 'pdf', media.objectKey, `${scratch}/searchable.pdf`],
      timeoutSeconds: 900,
      inputObjectKey: media.objectKey,
      outputObjectKey: `${scratch}/searchable.pdf`,
    });
  }
  return Object.freeze(
    steps.map((step) => Object.freeze({ ...step, args: Object.freeze([...step.args]) })),
  );
}

/**
 * Execute one previously validated pipeline step in a worker-owned directory.
 * The worker must resolve opaque object keys to local paths; shell interpolation
 * is intentionally unavailable. Missing binaries, timeouts, and non-zero exits
 * fail closed with stable error codes and bounded diagnostic output.
 */
export async function executeMediaPipelineStep(
  step: PipelineStep,
  options: MediaToolExecutionOptions,
): Promise<MediaToolExecutionResult> {
  if (!isAbsolute(options.cwd))
    throw new MediaExecutionError('MEDIA_TOOL_INVALID', 'cwd must be absolute');
  if (!Number.isInteger(step.timeoutSeconds) || step.timeoutSeconds <= 0)
    throw new MediaExecutionError('MEDIA_TOOL_INVALID', 'step timeout must be positive');
  const maxOutputBytes = options.maxOutputBytes ?? 64 * 1024;
  if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1024)
    throw new MediaExecutionError('MEDIA_TOOL_INVALID', 'max output must be at least 1024 bytes');
  const binary = options.binaries?.[step.tool] ?? step.tool;
  const workerRoot = resolvePath(options.cwd);
  const resolveWorkerPath = (objectKey: string): string => {
    const candidate = resolvePath(options.resolveObjectKey(objectKey));
    const relativePath = relative(workerRoot, candidate);
    const outside =
      relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath);
    if (outside)
      throw new MediaExecutionError(
        'MEDIA_TOOL_INVALID',
        'resolved object path escapes worker cwd',
      );
    return candidate;
  };
  const args = step.args.map((argument) => {
    if (argument === step.inputObjectKey) return resolveWorkerPath(argument);
    if (step.outputObjectKey !== undefined && argument === step.outputObjectKey)
      return resolveWorkerPath(argument);
    if (argument.includes('\u0000'))
      throw new MediaExecutionError('MEDIA_TOOL_INVALID', 'argv contains a NUL byte');
    return argument;
  });
  const started = performance.now();
  const childEnv: NodeJS.ProcessEnv = {
    ...(process.env.PATH ? { PATH: process.env.PATH } : {}),
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    ...(process.env.WINDIR ? { WINDIR: process.env.WINDIR } : {}),
    ...(process.env.TEMP ? { TEMP: process.env.TEMP } : {}),
    ...(process.env.TMP ? { TMP: process.env.TMP } : {}),
    ...options.env,
  };
  return new Promise<MediaToolExecutionResult>((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: options.cwd,
      env: childEnv,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const append = (current: string, chunk: Buffer): string => {
      const remaining = maxOutputBytes - Buffer.byteLength(current, 'utf8');
      if (remaining <= 0) return current;
      return current + chunk.subarray(0, remaining).toString('utf8');
    };
    child.stdout.on('data', (chunk: Buffer) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = append(stderr, chunk);
    });
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 250).unref();
    }, step.timeoutSeconds * 1000);
    child.once('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timeout);
      if (error.code === 'ENOENT') {
        reject(
          new MediaExecutionError('MEDIA_TOOL_UNAVAILABLE', `${step.tool} binary is unavailable`),
        );
      } else {
        reject(new MediaExecutionError('MEDIA_TOOL_FAILED', `${step.tool} could not start`));
      }
    });
    child.once('close', (exitCode, signal) => {
      clearTimeout(timeout);
      const durationMs = performance.now() - started;
      if (timedOut) {
        reject(new MediaExecutionError('MEDIA_TOOL_TIMEOUT', `${step.tool} exceeded its timeout`));
        return;
      }
      if (exitCode !== 0) {
        reject(new MediaExecutionError('MEDIA_TOOL_FAILED', `${step.tool} exited unsuccessfully`));
        return;
      }
      resolve(
        Object.freeze({
          tool: step.tool,
          binary,
          args: Object.freeze([...args]),
          exitCode,
          signal,
          stdout,
          stderr,
          durationMs,
        }),
      );
    });
  });
}

export function assertOriginalImmutable(
  original: MediaDescriptor,
  candidate: MediaDescriptor,
): void {
  if (original.id !== candidate.id || original.objectKey !== candidate.objectKey)
    throw new MediaPipelineError('original object identity is immutable');
  if (original.sha256Hex !== candidate.sha256Hex || original.byteSize !== candidate.byteSize)
    throw new MediaPipelineError('original object fixity is immutable');
}

export function scratchKey(jobId: EntityId): string {
  uuidSchema.parse(jobId);
  return `worker-scratch/${jobId}`;
}

export class MediaPipelineError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'MediaPipelineError';
  }
}

export type MediaExecutionErrorCode =
  'MEDIA_TOOL_INVALID' | 'MEDIA_TOOL_UNAVAILABLE' | 'MEDIA_TOOL_TIMEOUT' | 'MEDIA_TOOL_FAILED';

export class MediaExecutionError extends MediaPipelineError {
  public constructor(
    public readonly code: MediaExecutionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MediaExecutionError';
  }
}

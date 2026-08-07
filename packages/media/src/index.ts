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
  readonly tool: 'clamdscan' | 'ffprobe' | 'ffmpeg' | 'exiftool' | 'magick' | 'ocrmypdf';
  readonly args: readonly string[];
  readonly timeoutSeconds: number;
  readonly inputObjectKey: string;
  readonly outputObjectKey?: string;
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
      tool: 'clamdscan',
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

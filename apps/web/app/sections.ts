export type WorkspaceSection =
  | 'archive'
  | 'interviews'
  | 'media'
  | 'people'
  | 'timeline'
  | 'stories'
  | 'book'
  | 'audio'
  | 'family-portal'
  | 'rights'
  | 'settings';

export interface SectionState {
  kind:
    'ok' | 'warning' | 'error' | 'offline' | 'processing' | 'permission' | 'dispute' | 'withdrawn';
  title: string;
  detail: string;
}

export interface WorkspaceSectionManifest {
  slug: WorkspaceSection;
  label: string;
  summary: string;
  responsibilities: string[];
  states: SectionState[];
}

export const navigationSections: Array<{
  slug: WorkspaceSection;
  label: string;
  href: `/${WorkspaceSection}` | `/${Exclude<WorkspaceSection, 'family-portal'>}`;
}> = [
  { slug: 'archive', label: 'Archive', href: '/archive' },
  { slug: 'interviews', label: 'Interviews', href: '/interviews' },
  { slug: 'media', label: 'Media', href: '/media' },
  { slug: 'people', label: 'People', href: '/people' },
  { slug: 'timeline', label: 'Timeline', href: '/timeline' },
  { slug: 'stories', label: 'Stories', href: '/stories' },
  { slug: 'book', label: 'Book', href: '/book' },
  { slug: 'audio', label: 'Audio', href: '/audio' },
  { slug: 'family-portal', label: 'Family Portal', href: '/family-portal' },
  { slug: 'rights', label: 'Rights', href: '/rights' },
  { slug: 'settings', label: 'Settings', href: '/settings' },
];

export const sectionManifests: Record<WorkspaceSection, WorkspaceSectionManifest> = {
  archive: {
    slug: 'archive',
    label: 'Archive',
    summary:
      'Create, protect, and review a private family archive with explicit audience and deletion rules.',
    responsibilities: [
      'Define who can view each item.',
      'Enable or pause consent collection.',
      'Run periodic visibility reviews.',
      'Start publication only from approved editions.',
    ],
    states: [
      {
        kind: 'ok',
        title: 'Archive connected',
        detail: 'Authentication scope is active and signed.',
      },
      {
        kind: 'warning',
        title: 'Review needed',
        detail: 'At least one subject has unresolved rights status.',
      },
    ],
  },
  interviews: {
    slug: 'interviews',
    label: 'Interviews',
    summary:
      'Capture spoken memories with clearly visible recording state and a recoverable session workflow.',
    responsibilities: [
      'Start, pause, stop, and resume recording.',
      'Show elapsed time and upload progress.',
      'Keep consent state visible before and during capture.',
      'Protect subject-level media from accidental overwrite.',
    ],
    states: [
      { kind: 'ok', title: 'Recorder idle', detail: 'No live interview is in progress.' },
      {
        kind: 'processing',
        title: 'Ready state',
        detail: 'Upload progress available after finalization.',
      },
      {
        kind: 'error',
        title: 'Recovery guidance',
        detail: 'Use offline export if a session drops mid-upload.',
      },
    ],
  },
  media: {
    slug: 'media',
    label: 'Media',
    summary: 'Store originals as immutable evidence and track derivative generation progress.',
    responsibilities: [
      'Display upload sessions and completion status.',
      'Show checksum or quarantine warnings.',
      'Expose per-item deletion status and restoration points.',
    ],
    states: [
      {
        kind: 'processing',
        title: 'Media pipeline',
        detail: 'Media scan and normalization are queued.',
      },
      {
        kind: 'warning',
        title: 'Checksum mismatch',
        detail: 'Retry by opening the upload session and completing again.',
      },
      {
        kind: 'error',
        title: 'Disputed content',
        detail: 'One item has disputed rights and cannot publish.',
      },
    ],
  },
  people: {
    slug: 'people',
    label: 'People',
    summary: 'Record subject records, visibility classes, and guardian-authority notes.',
    responsibilities: [
      'Track each person’s visibility policy.',
      'Attach relation context without exposing protected data in logs.',
      'Separate living-person controls from historical records.',
    ],
    states: [
      {
        kind: 'ok',
        title: 'People records',
        detail: 'Living-person privacy controls are applied by default.',
      },
      {
        kind: 'withdrawn',
        title: 'Withdrawal',
        detail: 'One profile was marked as consent withdrawn.',
      },
      {
        kind: 'permission',
        title: 'Permission pending',
        detail: 'Guarded details are hidden until explicit approval.',
      },
    ],
  },
  timeline: {
    slug: 'timeline',
    label: 'Timeline',
    summary: 'Build a conflict-aware timeline of events with traceable sources.',
    responsibilities: [
      'Preserve uncertain dates and alternate recollections.',
      'Keep conflicting entries separated and inspectable.',
      'Link events to source capsules and evidence states.',
    ],
    states: [
      {
        kind: 'ok',
        title: 'Timeline graph',
        detail: 'Approximate dates retain dedicated uncertainty indicators.',
      },
      {
        kind: 'warning',
        title: 'Contradiction check',
        detail: 'Conflicting recollections remain unforced until review.',
      },
    ],
  },
  stories: {
    slug: 'stories',
    label: 'Stories',
    summary: 'Draft narrative chapters from confirmed facts and approved quotations.',
    responsibilities: [
      'Separate exact quote, paraphrase, and generated prose.',
      'Block unsupported or citation-missing claims.',
      'Preserve source revision IDs in every story block.',
    ],
    states: [
      {
        kind: 'ok',
        title: 'Draft ready',
        detail: 'Generated drafts are tracked with provenance metadata.',
      },
      {
        kind: 'warning',
        title: 'Claim review',
        detail: 'Unsupported claims are staged until evidence is attached.',
      },
    ],
  },
  book: {
    slug: 'book',
    label: 'Book',
    summary: 'Assemble export-ready manuscripts with approval gates and versioned assets.',
    responsibilities: [
      'Estimate pass-through cost before expensive build actions.',
      'Keep generation resumable after interruption.',
      'Track PDF/EPUB artifact lineage and integrity manifests.',
    ],
    states: [
      {
        kind: 'processing',
        title: 'Export planning',
        detail: 'Build cost estimate is displayed before generation.',
      },
      {
        kind: 'ok',
        title: 'Export ready',
        detail: 'Manifests include checksums and evidence references.',
      },
    ],
  },
  audio: {
    slug: 'audio',
    label: 'Audio',
    summary:
      'Generate narration from approved scripts using stock or verified living-subject voices only.',
    responsibilities: [
      'Prevent unauthorized voice creation.',
      'Track narrator policy and consent state.',
      'Expose failed voice jobs with safe recovery steps.',
    ],
    states: [
      {
        kind: 'warning',
        title: 'Subject verification required',
        detail: 'Voice generation needs verified living-subject consent.',
      },
      {
        kind: 'ok',
        title: 'Narration policy',
        detail: 'Only approved providers and allowed voices are exposed.',
      },
    ],
  },
  'family-portal': {
    slug: 'family-portal',
    label: 'Family Portal',
    summary: 'Maintain portal access, review logs, and revocable link control.',
    responsibilities: [
      'Offer public and private link controls.',
      'Log access and expiry decisions.',
      'Prevent public sharing when rights or consent is unresolved.',
    ],
    states: [
      {
        kind: 'permission',
        title: 'Permission denied mode',
        detail: 'Portal sharing is blocked for this archive.',
      },
      {
        kind: 'offline',
        title: 'Offline support',
        detail: 'Fallback view explains the last successful local session.',
      },
    ],
  },
  rights: {
    slug: 'rights',
    label: 'Rights',
    summary: 'Capture subject rights, releases, and publication restrictions in one workflow.',
    responsibilities: [
      'Surface missing releases and unresolved disputes.',
      'Prevent export or share when rights gate is unresolved.',
      'Track review action history and owner decisions.',
    ],
    states: [
      {
        kind: 'dispute',
        title: 'Rights dispute',
        detail: 'One subject has an unresolved rights dispute.',
      },
      {
        kind: 'warning',
        title: 'Pending publication review',
        detail: 'Review is required before any public page is enabled.',
      },
      {
        kind: 'ok',
        title: 'Rights evidence',
        detail: 'Release and consent references are attached where available.',
      },
    ],
  },
  settings: {
    slug: 'settings',
    label: 'Settings',
    summary: 'Review security, consent defaults, deletion, and billing guardrails.',
    responsibilities: [
      'Adjust consent defaults by sensitivity.',
      'Review deletion, retention, and privacy controls.',
      'Inspect processing and budget thresholds.',
    ],
    states: [
      {
        kind: 'error',
        title: 'Connectivity',
        detail: 'API connectivity is degraded; offline mode is now active.',
      },
      {
        kind: 'ok',
        title: 'Controls',
        detail: 'Retention and deletion schedules are visible and auditable.',
      },
      {
        kind: 'dispute',
        title: 'Data export',
        detail: 'Export tasks keep immutable provenance attached to each file set.',
      },
    ],
  },
};

export function sectionPathFor(slug: WorkspaceSection): string {
  return `/${slug}`;
}

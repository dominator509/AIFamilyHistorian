import Link from 'next/link';
import { navigationSections, sectionManifests, type WorkspaceSection } from '../sections';
import { SectionCard } from '../components/section-card';
import { WorkspaceShell } from '../components/workspace-shell';

const validSections: WorkspaceSection[] = navigationSections.map((section) => section.slug);

type SectionPageProps = {
  params: Promise<{ section: string }> | { section: string };
};

function getInvalidSectionRoute() {
  return (
    <section className="panel">
      <h2>Unknown section</h2>
      <p>The requested section is not part of the approved workspace schema.</p>
      <Link href="/" className="inline-link">
        Return to workspace
      </Link>
    </section>
  );
}

export default async function WorkspaceSectionPage({ params }: SectionPageProps) {
  const resolved = await Promise.resolve(params);
  const slug = resolved.section;
  const key = slug as WorkspaceSection;

  if (!validSections.includes(key)) {
    return <WorkspaceShell>{getInvalidSectionRoute()}</WorkspaceShell>;
  }

  const manifest = sectionManifests[key];
  return (
    <WorkspaceShell selectedSlug={manifest.slug}>
      <section className="panel">
        <p className="eyebrow">{manifest.label}</p>
        <h2>Workspace: {manifest.label}</h2>
        <SectionCard manifest={manifest} />
      </section>
      <section aria-label="Recorder and workflow safety" className="panel">
        <h3>Recorder and workflow safety</h3>
        <ul className="plain-list">
          <li>Show explicit consent state before and during any capture operation.</li>
          <li>
            Display elapsed time, upload progress, and retry guidance when network state changes.
          </li>
          <li>
            Keep transcript correction keyboard-first and expose citation source status per edit.
          </li>
          <li>
            Fail closed for disputed rights, withdrawn subject consent, and permission-denied modes.
          </li>
        </ul>
      </section>
    </WorkspaceShell>
  );
}

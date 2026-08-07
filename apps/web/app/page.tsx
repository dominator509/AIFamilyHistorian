import { sectionManifests } from './sections';
import { SectionCard } from './components/section-card';
import { WorkspaceShell } from './components/workspace-shell';

export default function HomePage() {
  const featuredSections = [
    'archive',
    'interviews',
    'people',
    'rights',
    'book',
    'family-portal',
  ] as const;

  return (
    <WorkspaceShell>
      <section className="hero-panel">
        <h2>Welcome to the preservation workflow</h2>
        <p>
          Your stories, evidence, and approvals move through each stage in the order you set. This
          workspace keeps source links visible and prevents unsafe publication by default.
        </p>
      </section>

      <section aria-label="Featured sections">
        <h2>Core areas</h2>
        <p className="section-subtext">
          Start in a section, check status states, then continue only after consent, rights, and
          review gates are green.
        </p>
        <div className="section-grid">
          {featuredSections.map((slug) => (
            <SectionCard key={slug} manifest={sectionManifests[slug]} />
          ))}
        </div>
      </section>
    </WorkspaceShell>
  );
}

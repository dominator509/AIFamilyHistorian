import type { ReactNode } from 'react';

import type { WorkspaceSectionManifest } from '../sections';

interface SectionCardProps {
  manifest: WorkspaceSectionManifest;
  renderStateList?: boolean;
}

export function SectionCard({ manifest, renderStateList = true }: SectionCardProps): ReactNode {
  return (
    <article className="section-card" aria-labelledby={`${manifest.slug}-section-title`}>
      <h2 id={`${manifest.slug}-section-title`} className="section-title">
        {manifest.label}
      </h2>
      <p className="section-summary">{manifest.summary}</p>
      <ul className="section-responsibilities" aria-label={`${manifest.label} responsibilities`}>
        {manifest.responsibilities.map((responsibility) => (
          <li key={responsibility}>{responsibility}</li>
        ))}
      </ul>
      {renderStateList ? (
        <div className="state-rail" aria-label={`${manifest.label} status states`}>
          <h3 className="state-heading">Operational states</h3>
          <ul className="state-list">
            {manifest.states.map((state) => (
              <li key={state.title} className={`status-pill status-${state.kind}`}>
                <span className="status-title">{state.title}</span>
                <span className="status-detail">{state.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

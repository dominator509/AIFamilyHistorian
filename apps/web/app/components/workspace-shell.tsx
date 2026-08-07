import Link from 'next/link';

import { navigationSections } from '../sections';

export function WorkspaceShell({
  selectedSlug,
  children,
}: {
  selectedSlug?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="workspace-shell">
      <header className="app-header">
        <p className="eyebrow">Older-adult-friendly private archive</p>
        <h1>Family Historian Workspace</h1>
      </header>
      <p className="lede">
        Keep every memory linked to provenance, privacy, and rights evidence before sharing.
      </p>
      <nav aria-label="Workspace sections">
        <ul className="sections-nav">
          {navigationSections.map((item) => (
            <li key={item.slug}>
              <Link
                href={item.href}
                aria-current={selectedSlug === item.slug ? 'page' : undefined}
                className={selectedSlug === item.slug ? 'nav-link selected' : 'nav-link'}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main>{children}</main>
    </div>
  );
}

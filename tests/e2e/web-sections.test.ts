import { describe, expect, it } from 'vitest';

import {
  navigationSections,
  sectionManifests,
  sectionPathFor,
  type WorkspaceSection,
} from '../../apps/web/app/sections';

const expectedSections: WorkspaceSection[] = [
  'archive',
  'interviews',
  'media',
  'people',
  'timeline',
  'stories',
  'book',
  'audio',
  'family-portal',
  'rights',
  'settings',
];

const requiredStateKinds = [
  'ok',
  'warning',
  'error',
  'offline',
  'processing',
  'permission',
  'dispute',
  'withdrawn',
] as const;

describe('workspace UI manifest contract', () => {
  it('exposes the required top-level sections in canonical order', () => {
    const configured = navigationSections.map((section) => section.slug);
    expect(configured).toEqual(expectedSections);
  });

  it('maps each section manifest to a valid route and label', () => {
    for (const slug of expectedSections) {
      const manifest = sectionManifests[slug];
      const nav = navigationSections.find((item) => item.slug === slug);

      expect(manifest).toBeDefined();
      expect(nav).toBeDefined();
      expect(nav).toBeDefined();
      expect(sectionPathFor(slug)).toBe(`/${slug}`);
      expect(nav?.label.length).toBeGreaterThan(2);
    }
  });

  it('defines at least one actionable state for every section', () => {
    for (const [slug, manifest] of Object.entries(sectionManifests)) {
      expect(manifest.states.length).toBeGreaterThan(0);
      expect(manifest.summary.length).toBeGreaterThan(10);
      expect(manifest.responsibilities.length).toBeGreaterThan(2);
      for (const state of manifest.states) {
        expect(requiredStateKinds).toContain(state.kind);
        expect(state.title.length).toBeGreaterThan(2);
        expect(state.detail.length).toBeGreaterThan(5);
      }
      expect(slug as WorkspaceSection).toBeTypeOf('string');
    }
  });

  it('marks rights- and workflow-sensitive sections with review language', () => {
    const sensitive: WorkspaceSection[] = ['interviews', 'rights', 'people', 'settings', 'book'];
    for (const slug of sensitive) {
      const textBundle = sectionManifests[slug].states.map((state) => state.title.toLowerCase());
      const detailBundle = sectionManifests[slug].states.map((state) => state.detail.toLowerCase());
      const allText = [...textBundle, ...detailBundle].join(' ');
      expect(allText.length).toBeGreaterThan(20);
      expect(
        allText.includes('review') ||
          allText.includes('consent') ||
          allText.includes('dispute') ||
          allText.includes('publish') ||
          allText.includes('rights') ||
          allText.includes('export') ||
          allText.includes('offline'),
      ).toBe(true);
    }
  });
});

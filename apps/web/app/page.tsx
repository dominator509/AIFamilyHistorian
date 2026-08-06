const sections = [
  'Archive',
  'Interviews',
  'Media',
  'People',
  'Timeline',
  'Stories',
  'Book',
  'Audio',
  'Family Portal',
  'Rights',
  'Settings',
];

export default function HomePage() {
  return (
    <main>
      <p className="eyebrow">Private by default</p>
      <h1>Keep every memory connected to its source.</h1>
      <p className="lede">
        Capture family stories, confirm what is known, preserve original media, and prepare
        trustworthy private editions without presenting generated prose as evidence.
      </p>
      <nav aria-label="Product areas">
        <ul>
          {sections.map((section) => (
            <li key={section}>{section}</li>
          ))}
        </ul>
      </nav>
    </main>
  );
}

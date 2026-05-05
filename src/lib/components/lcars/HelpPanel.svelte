<script lang="ts">
  import DOMPurify from 'dompurify';
  import { marked, type RendererObject } from 'marked';
  import readmeSource from '../../../../README.md?raw';

  function escapeAttr(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Rewrite image paths: README uses `static/foo.png` but at runtime
  // SvelteKit serves the static directory from the root as `/foo.png`.
  const renderer: RendererObject = {
    image({ href, title, text }) {
      const resolved = href.startsWith('static/') ? href.slice('static/'.length) : href;
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
      return `<img src="/${escapeAttr(resolved)}" alt="${escapeAttr(text)}"${titleAttr} class="help-img" />`;
    },
  };
  marked.use({ renderer });

  const rawHtml = marked.parse(readmeSource) as string;
  const html = DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
</script>

<article class="help-panel">
  <header class="panel-header">
    <p class="lcars-label">Documentation</p>
    <h2>Help &amp; Reference</h2>
  </header>
  <div class="help-body">
    <!-- README is a static project file bundled at build time; not user input -->
    {@html html}
  </div>
</article>

<style>
  .help-panel {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border-subtle);
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;
  }

  .help-body {
    overflow-y: auto;
    padding: var(--space-5) var(--space-6);
    flex: 1;
    color: var(--color-text-primary);
    font-family: var(--font-body);
    line-height: 1.7;
  }

  .help-body :global(h1) {
    font-family: var(--font-display);
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--color-lcars-orange);
    border-bottom: 2px solid var(--color-border-default);
    padding-bottom: var(--space-2);
    margin: 0 0 var(--space-4);
  }

  .help-body :global(h2) {
    font-family: var(--font-display);
    font-size: 1.35rem;
    font-weight: 600;
    color: var(--color-lcars-cyan);
    border-bottom: 1px solid var(--color-border-subtle);
    padding-bottom: var(--space-1);
    margin: var(--space-6) 0 var(--space-3);
  }

  .help-body :global(h3) {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-lcars-amber);
    margin: var(--space-5) 0 var(--space-2);
  }

  .help-body :global(h4),
  .help-body :global(h5),
  .help-body :global(h6) {
    font-family: var(--font-display);
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin: var(--space-4) 0 var(--space-2);
  }

  .help-body :global(p) {
    margin: 0 0 var(--space-3);
  }

  .help-body :global(ul),
  .help-body :global(ol) {
    margin: 0 0 var(--space-3);
    padding-left: var(--space-5);
  }

  .help-body :global(li) {
    margin-bottom: var(--space-1);
  }

  .help-body :global(code) {
    font-family: var(--font-mono);
    font-size: 0.85em;
    background: rgba(255, 138, 28, 0.1);
    color: var(--color-lcars-orange);
    padding: 0.1em 0.35em;
    border-radius: 3px;
  }

  .help-body :global(pre) {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border-default);
    border-radius: 4px;
    padding: var(--space-4);
    overflow-x: auto;
    margin: 0 0 var(--space-4);
  }

  .help-body :global(pre code) {
    background: none;
    color: var(--color-text-primary);
    padding: 0;
    font-size: 0.875rem;
  }

  .help-body :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 var(--space-4);
    font-size: 0.9rem;
  }

  .help-body :global(th) {
    background: var(--color-bg-elevated);
    color: var(--color-lcars-cyan);
    font-family: var(--font-display);
    font-weight: 600;
    text-align: left;
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--color-border-strong);
  }

  .help-body :global(td) {
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--color-border-subtle);
    vertical-align: top;
  }

  .help-body :global(tr:last-child td) {
    border-bottom: none;
  }

  .help-body :global(a) {
    color: var(--color-lcars-violet);
    text-decoration: underline;
  }

  .help-body :global(a:hover) {
    color: var(--color-lcars-blue);
  }

  .help-body :global(blockquote) {
    border-left: 3px solid var(--color-lcars-purple);
    margin: 0 0 var(--space-3);
    padding: var(--space-2) var(--space-4);
    color: var(--color-text-secondary);
    font-style: italic;
  }

  .help-body :global(hr) {
    border: none;
    border-top: 1px solid var(--color-border-default);
    margin: var(--space-5) 0;
  }

  .help-body :global(.help-img) {
    max-width: 100%;
    height: auto;
    display: block;
    border-radius: 4px;
    margin: var(--space-4) 0;
  }
</style>

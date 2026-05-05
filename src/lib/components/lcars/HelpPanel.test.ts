import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';

// marked produces real HTML; no need to mock it.
// README?raw import needs a module mock.
vi.mock('../../../../README.md?raw', () => ({
  default:
    '# Product Overlord\n\n## Application surfaces\n\nUse the navigation rail to switch surfaces.\n\n### Command\n\nThe primary operations panel.\n\n## Workflows\n\nStep-by-step guides for common tasks.',
}));

import HelpPanel from './HelpPanel.svelte';

describe('HelpPanel', () => {
  it('renders at least one heading element', () => {
    const { container } = render(HelpPanel);
    const headings = container.querySelectorAll('h1, h2, h3');
    expect(headings.length).toBeGreaterThan(0);
  });

  it('renders the h1 from README', () => {
    const { container } = render(HelpPanel);
    const h1 = container.querySelector('h1');
    expect(h1).toBeTruthy();
    expect(h1!.textContent).toContain('Product Overlord');
  });

  it('renders expected section headings from README', () => {
    const { container } = render(HelpPanel);
    const headingTexts = Array.from(container.querySelectorAll('h2')).map((el) => el.textContent ?? '');
    expect(headingTexts).toContain('Application surfaces');
    expect(headingTexts).toContain('Workflows');
  });

  it('renders a help-panel article element', () => {
    const { container } = render(HelpPanel);
    expect(container.querySelector('article.help-panel')).toBeTruthy();
  });
});

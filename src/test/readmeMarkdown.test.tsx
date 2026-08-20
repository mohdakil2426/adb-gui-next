import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReadmeMarkdown } from '@/features/marketplace/ui/app-detail/ReadmeMarkdown';

describe('ReadmeMarkdown', () => {
  it('renders headings and paragraphs correctly', () => {
    const md = '# Title\n\n## Subtitle\n\nParagraph text here.';
    render(<ReadmeMarkdown markdown={md} />);

    expect(screen.getByRole('heading', { level: 2, name: /title/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /subtitle/i })).toBeInTheDocument();
    expect(screen.getByText('Paragraph text here.')).toBeInTheDocument();
  });

  it('renders markdown images and links with proper attributes', () => {
    const md =
      '![App Icon](https://raw.githubusercontent.com/owner/repo/main/logo.png)\n\n[Website](https://example.com)';
    render(<ReadmeMarkdown markdown={md} />);

    const img = screen.getByRole('img', { name: /app icon/i });
    expect(img).toHaveAttribute(
      'src',
      'https://raw.githubusercontent.com/owner/repo/main/logo.png',
    );

    const link = screen.getByRole('link', { name: /website/i });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders GFM pipe tables with headers and rows', () => {
    const md =
      '| Feature | Status |\n|---|---|\n| Root Support | Active |\n| Audio Convolver | Enabled |';
    render(<ReadmeMarkdown markdown={md} />);

    expect(screen.getByText('Feature')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Root Support')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Audio Convolver')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });

  it('renders fenced code blocks with language banner', () => {
    const md = '```bash\nadb install app.apk\n```';
    render(<ReadmeMarkdown markdown={md} />);

    expect(screen.getByText(/bash/i)).toBeInTheDocument();
    expect(screen.getByText('adb install app.apk')).toBeInTheDocument();
  });

  it('renders task list items with checked and unchecked states', () => {
    const md = '- [x] Completed task\n- [ ] Pending task';
    render(<ReadmeMarkdown markdown={md} />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
    expect(screen.getByText('Completed task')).toBeInTheDocument();
    expect(screen.getByText('Pending task')).toBeInTheDocument();
  });

  it('renders blockquotes and inline styles', () => {
    const md = '> Important note here with **bold** and `code` and ~~strikethrough~~';
    render(<ReadmeMarkdown markdown={md} />);

    expect(screen.getByText(/Important note here/i)).toBeInTheDocument();
    expect(screen.getByText('bold')).toBeInTheDocument();
    expect(screen.getByText('code')).toBeInTheDocument();
    expect(screen.getByText('strikethrough')).toBeInTheDocument();
  });

  it('renders GitHub alerts with title and custom icons', () => {
    const md = '> [!NOTE]\n> This is a helpful note\n\n> [!WARNING]\n> High risk warning';
    render(<ReadmeMarkdown markdown={md} />);

    expect(screen.getByText('Note')).toBeInTheDocument();
    expect(screen.getByText('This is a helpful note')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('High risk warning')).toBeInTheDocument();
  });

  it('renders keyboard, superscript, and subscript tags', () => {
    const md = 'Press <kbd>Ctrl+F</kbd> for search. x<sup>2</sup> and H<sub>2</sub>O';
    render(<ReadmeMarkdown markdown={md} />);

    expect(screen.getByText('Ctrl+F')).toBeInTheDocument();
    expect(screen.getAllByText('2')).toHaveLength(2);
  });
});

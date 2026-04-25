import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FileSelector } from '@/components/FileSelector';

describe('FileSelector', () => {
  it('shows the full selected path in visible assistive text instead of native title', () => {
    render(
      <FileSelector label="Payload File" path="/sdcard/Download/payload.bin" onSelect={() => {}} />,
    );

    const fullPath = screen.getByText('/sdcard/Download/payload.bin');
    expect(fullPath).toBeInTheDocument();
    expect(fullPath).not.toHaveAttribute('title');
  });
});

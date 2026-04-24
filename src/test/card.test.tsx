import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CardTitle } from '@/components/ui/card';

describe('CardTitle', () => {
  it('renders as an h2 by default', () => {
    render(<CardTitle>Device Info</CardTitle>);

    expect(screen.getByRole('heading', { level: 2, name: 'Device Info' })).toBeInTheDocument();
  });

  it('supports a lower heading level when nested', () => {
    render(<CardTitle as="h3">Partition Details</CardTitle>);

    expect(
      screen.getByRole('heading', { level: 3, name: 'Partition Details' }),
    ).toBeInTheDocument();
  });
});

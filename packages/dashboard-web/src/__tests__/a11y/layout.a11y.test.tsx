import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import RootLayout from '@/app/layout';

expect.extend(toHaveNoViolations);

describe('Layout Accessibility', () => {
  it('should not have accessibility violations', async () => {
    const { container } = render(
      <RootLayout>
        <div>Test content</div>
      </RootLayout>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have skip to main content link', () => {
    const { getByText } = render(
      <RootLayout>
        <div>Test content</div>
      </RootLayout>,
    );
    const skipLink = getByText(/skip to main content/i);
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  it('should have main content with proper id', () => {
    const { container } = render(
      <RootLayout>
        <div>Test content</div>
      </RootLayout>,
    );
    const mainContent = container.querySelector('#main-content');
    expect(mainContent).toBeInTheDocument();
  });
});

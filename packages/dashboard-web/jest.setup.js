// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Extend Jest matchers for accessibility testing
import { toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

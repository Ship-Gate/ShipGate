import { describe, it, expect } from 'vitest'
import * as mod from '../src/index'

describe('exports', () => {
  it('exports something', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0)
  })
  
  it('has valid exports', () => {
    // Add specific tests for your exports here
    expect(mod).toBeDefined()
  })
})

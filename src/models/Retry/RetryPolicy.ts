import { ExponentialWithBackoff } from './ExponentialWithBackoff'
import { Spaced } from './Spaced'

export abstract class RetryPolicy {
  constructor(maxRetries: number) {
    this.maxRetries = maxRetries
  }

  maxRetries: number
}

export const RetryPolicies = {
  spaced: (interval: number, maxRetries: number): Spaced =>
    new Spaced(interval, maxRetries),

  exponentialWithBackoff: (
    initialInterval: number,
    maxRetries: number,
    base = 2
  ): ExponentialWithBackoff =>
    new ExponentialWithBackoff(initialInterval, maxRetries, base)
}

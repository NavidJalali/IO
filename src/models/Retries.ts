export abstract class RetryPolicy {
  constructor(maxRetries: number) {
    this.maxRetries = maxRetries
  }

  maxRetries: number
}

export class Spaced extends RetryPolicy {
  constructor(interval: number, maxRetries: number) {
    super(maxRetries)
    this.interval = interval
  }

  interval: number
}

export class ExponentialWithBackoff extends RetryPolicy {
  constructor(initialInterval: number, maxRetries: number, base: number) {
    super(maxRetries)
    this.initialInterval = initialInterval
    this.base = base
  }

  initialInterval: number
  base: number
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

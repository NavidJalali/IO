import { RetryPolicy } from './RetryPolicy'

export class ExponentialWithBackoff extends RetryPolicy {
  constructor(initialInterval: number, maxRetries: number, base: number) {
    super(maxRetries)
    this.initialInterval = initialInterval
    this.base = base
  }

  initialInterval: number
  base: number
}

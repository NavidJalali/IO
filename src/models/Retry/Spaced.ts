import { RetryPolicy } from './RetryPolicy'

export class Spaced extends RetryPolicy {
  constructor(interval: number, maxRetries: number) {
    super(maxRetries)
    this.interval = interval
  }

  interval: number
}

export abstract class RetryPolicy {
  constructor(maxRetries: number) {
    this.maxRetries = maxRetries
  }

  maxRetries: number
}

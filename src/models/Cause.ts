import { CauseTypeTag } from './Tag'

export abstract class Cause<E> {
  abstract tag: CauseTypeTag
  abstract error: E | null
}

export class Die extends Cause<never> {
  constructor(error: unknown) {
    super()
    this.reason = error
  }

  tag: CauseTypeTag = 'Die'

  error = null

  reason: unknown
}

export class Fail<E> extends Cause<E> {
  constructor(error: E) {
    super()
    this.error = error
  }

  tag: CauseTypeTag = 'Fail'

  error: E
}

export class Interrupt extends Cause<never> {
  constructor() {
    super()
  }

  error = null

  tag: CauseTypeTag = 'Interrupt'
}

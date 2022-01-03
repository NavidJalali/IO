import { CauseTypeTag } from './Tag'

export abstract class Cause<E> {
  abstract tag: CauseTypeTag
  abstract error: E | null
  abstract fold<A>(
    ifFail: (_: E) => A,
    ifDie: (_: unknown) => A,
    ifInterrupt: () => A
  ): A
}

export class Die extends Cause<never> {
  constructor(error: unknown) {
    super()
    this.reason = error
  }

  tag: CauseTypeTag = 'Die'

  error = null

  reason: unknown

  fold<A>(_: (_: never) => A, ifDie: (_: unknown) => A, __: () => A): A {
    return ifDie(this.reason)
  }
}

export class Fail<E> extends Cause<E> {
  constructor(error: E) {
    super()
    this.error = error
  }

  tag: CauseTypeTag = 'Fail'

  error: E

  fold<A>(ifFail: (_: E) => A, _: (_: unknown) => A, __: () => A): A {
    return ifFail(this.error)
  }
}

export class Interrupt extends Cause<never> {
  constructor() {
    super()
  }

  error = null

  tag: CauseTypeTag = 'Interrupt'

  fold<A>(_: (_: never) => A, __: (_: unknown) => A, ifInterrupt: () => A): A {
    return ifInterrupt()
  }
}

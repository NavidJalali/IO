import { CauseTypeTag } from './Tag'

export abstract class Cause<E> {
  abstract tag: CauseTypeTag
  abstract error: E | null
  abstract fold<A>(
    ifFail: (_: Fail<E>) => A,
    ifDie: (_: Die) => A,
    ifInterrupt: (_: Interrupt) => A
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

  fold<A>(
    _: (_: Fail<never>) => A,
    ifDie: (_: Die) => A,
    __: (_: Interrupt) => A
  ): A {
    return ifDie(this)
  }
}

export class Fail<E> extends Cause<E> {
  constructor(error: E) {
    super()
    this.error = error
  }

  tag: CauseTypeTag = 'Fail'

  error: E

  fold<A>(
    ifFail: (_: Fail<E>) => A,
    _: (_: Die) => A,
    __: (_: Interrupt) => A
  ): A {
    return ifFail(this)
  }
}

export class Interrupt extends Cause<never> {
  constructor() {
    super()
  }

  error = null

  tag: CauseTypeTag = 'Interrupt'

  fold<A>(
    _: (_: Fail<never>) => A,
    __: (_: Die) => A,
    ifInterrupt: (_: Interrupt) => A
  ): A {
    return ifInterrupt(this)
  }
}

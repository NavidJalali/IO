export abstract class Cause<E> {
  abstract fold<A>(
    ifFail: (_: Fail<E>) => A,
    ifDie: (_: Die) => A,
    ifInterrupt: (_: Interrupt) => A,
    ifThen: (_: Then<E>) => A,
    ifBoth: (_: Both<E>) => A
  ): A

  abstract map<A>(f: (_: E) => A): Cause<A>

  then(that: Cause<E>): Cause<E> {
    return new Then(this, that)
  }

  both(that: Cause<E>): Cause<E> {
    return new Both(this, that)
  }
}

export class Die extends Cause<never> {
  constructor(error: unknown) {
    super()
    this.reason = error
  }

  reason: unknown

  fold<A>(
    _: (_: Fail<never>) => A,
    ifDie: (_: Die) => A,
    __: (_: Interrupt) => A,
    ___: (_: Then<never>) => A,
    ____: (_: Both<never>) => A
  ): A {
    return ifDie(this)
  }

  map<A>(_: (_: never) => A): Cause<A> {
    return this as Cause<A>
  }
}

export class Fail<E> extends Cause<E> {
  constructor(error: E) {
    super()
    this.error = error
  }

  error: E

  fold<A>(
    ifFail: (_: Fail<E>) => A,
    _: (_: Die) => A,
    __: (_: Interrupt) => A,
    ___: (_: Then<E>) => A,
    ____: (_: Both<E>) => A
  ): A {
    return ifFail(this)
  }

  map<A>(f: (_: E) => A): Cause<A> {
    return new Fail(f(this.error))
  }
}

export class Interrupt extends Cause<never> {
  constructor() {
    super()
  }

  error = null

  fold<A>(
    _: (_: Fail<never>) => A,
    __: (_: Die) => A,
    ifInterrupt: (_: Interrupt) => A,
    ___: (_: Then<never>) => A,
    ____: (_: Both<never>) => A
  ): A {
    return ifInterrupt(this)
  }

  map<A>(_: (_: never) => A): Cause<A> {
    return this as Cause<A>
  }
}

export class Then<E> extends Cause<E> {
  constructor(left: Cause<E>, right: Cause<E>) {
    super()
    this.left = left
    this.right = right
  }

  left: Cause<E>
  right: Cause<E>

  fold<A>(
    _: (_: Fail<E>) => A,
    __: (_: Die) => A,
    ___: (_: Interrupt) => A,
    ifThen: (_: Then<E>) => A,
    ____: (_: Both<E>) => A
  ): A {
    return ifThen(this)
  }

  map<A>(f: (_: E) => A): Cause<A> {
    return new Then(this.left.map(f), this.right.map(f))
  }
}

export class Both<E> extends Cause<E> {
  constructor(left: Cause<E>, right: Cause<E>) {
    super()
    this.left = left
    this.right = right
  }

  left: Cause<E>
  right: Cause<E>

  fold<A>(
    _: (_: Fail<E>) => A,
    __: (_: Die) => A,
    ___: (_: Interrupt) => A,
    ____: (_: Then<E>) => A,
    ifBoth: (_: Both<E>) => A
  ): A {
    return ifBoth(this)
  }

  map<A>(f: (_: E) => A): Cause<A> {
    return new Both(this.left.map(f), this.right.map(f))
  }
}

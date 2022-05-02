export abstract class Cause<E> {
  abstract fold<A>(
    ifFail: (error: E) => A,
    ifDie: (reason: unknown) => A,
    ifInterrupt: () => A,
    ifThen: (left: A, right: A) => A,
    ifBoth: (left: A, right: A) => A
  ): A

  as<A>(a: A): Cause<A> {
    return this.map(_ => a)
  }

  abstract map<A>(f: (_: E) => A): Cause<A>

  static fail<A>(e: A): Cause<A> {
    return new Fail(e)
  }

  static die(e: unknown): Cause<never> {
    return new Die(e)
  }

  static interrupt(): Cause<never> {
    return new Interrupt()
  }

  static then<A>(left: Cause<A>, right: Cause<A>): Cause<A> {
    return new Then(left, right)
  }

  static both<A>(left: Cause<A>, right: Cause<A>): Cause<A> {
    return new Both(left, right)
  }

  then(that: Cause<E>): Cause<E> {
    return new Then(this, that)
  }

  both(that: Cause<E>): Cause<E> {
    return new Both(this, that)
  }

  abstract equals(that: any): boolean

  failureOption(): E | null {
    return this.fold(_ => _, _ => null, () => null, (_, __) => null, (_, __) => null)
  }

  abstract foldFailureOrCause<A>(ifFailure: (_: E) => A, ifCause: (_: Cause<E>) => A): A
}

export class Die extends Cause<never> {
  constructor(error: unknown) {
    super()
    this.reason = error
  }

  reason: unknown

  fold<A>(_: (_: never) => A, ifDie: (reason: unknown) => A, __: () => A, ___: (left: A, __: A) => A, ____: (_: A, __: A) => A): A {
    return ifDie(this.reason)
  }

  foldFailureOrCause<A>(_: (_: never) => A, ifCause: (_: Cause<never>) => A): A {
    return ifCause(this)
  }

  map<A>(_: (_: never) => A): Cause<A> {
    return this as Cause<A>
  }

  equals(that: any): boolean {
    if (that instanceof Die) {
      return that.reason === this.reason
    } else {
      return false
    }
  }
}

export class Fail<E> extends Cause<E> {
  constructor(error: E) {
    super()
    this.error = error
  }

  error: E

  fold<A>(ifFail: (error: E) => A, _: (reason: unknown) => A, __: () => A, ___: (left: A, right: A) => A, ____: (left: A, right: A) => A): A {
    return ifFail(this.error)
  }

  foldFailureOrCause<A>(ifFailure: (_: E) => A, _: (_: Cause<never>) => A): A {
    return ifFailure(this.error)
  }

  map<A>(f: (_: E) => A): Cause<A> {
    return new Fail(f(this.error))
  }

  equals(that: any): boolean {
    if (that instanceof Fail) {
      return that.error === this.error
    } else {
      return false
    }
  }
}

export class Interrupt extends Cause<never> {
  constructor() {
    super()
  }

  error = null

  fold<A>(_: (error: never) => A, __: (reason: unknown) => A, ifInterrupt: () => A, ___: (left: A, right: A) => A, ____: (left: A, right: A) => A): A {
    return ifInterrupt()
  }

  foldFailureOrCause<A>(_: (_: never) => A, ifCause: (_: Cause<never>) => A): A {
    return ifCause(this)
  }

  map<A>(_: (_: never) => A): Cause<A> {
    return this as Cause<A>
  }

  equals(that: any): boolean {
    if (that instanceof Interrupt) {
      return that.error === that.error
    } else {
      return false
    }
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

  fold<A>(ifFail: (error: E) => A, ifDie: (reason: unknown) => A, ifInterrupt: () => A, ifThen: (left: A, right: A) => A, ifBoth: (left: A, right: A) => A): A {
    return ifThen(this.left.fold(ifFail, ifDie, ifInterrupt, ifThen, ifBoth), this.right.fold(ifFail, ifDie, ifInterrupt, ifThen, ifBoth))
  }

  foldFailureOrCause<A>(_: (_: E) => A, ifCause: (_: Cause<E>) => A): A {
    return ifCause(this)
  }

  map<A>(f: (_: E) => A): Cause<A> {
    return new Then(this.left.map(f), this.right.map(f))
  }

  equals(that: any): boolean {
    if (that instanceof Then) {
      return (this.left.equals(that.left) && this.right.equals(that.right)) || (this.left.equals(that.right) && this.right.equals(that.left))
    } else {
      return false
    }
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

  fold<A>(ifFail: (error: E) => A, ifDie: (reason: unknown) => A, ifInterrupt: () => A, ifThen: (left: A, right: A) => A, ifBoth: (left: A, right: A) => A): A {
    return ifBoth(this.left.fold(ifFail, ifDie, ifInterrupt, ifThen, ifBoth), this.right.fold(ifFail, ifDie, ifInterrupt, ifThen, ifBoth))
  }

  foldFailureOrCause<A>(_: (_: E) => A, ifCause: (_: Cause<E>) => A): A {
    return ifCause(this)
  }

  map<A>(f: (_: E) => A): Cause<A> {
    return new Both(this.left.map(f), this.right.map(f))
  }

  equals(that: any): boolean {
    if (that instanceof Both) {
      return (this.left.equals(that.left) && this.right.equals(that.right)) || (this.left.equals(that.right) && this.right.equals(that.left))
    } else {
      return false
    }
  }
}

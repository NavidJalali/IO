import { Cause, Fail } from './Cause'

export abstract class Exit<E, A> {
  static succeed<B>(value: B): Exit<never, B> {
    return new Success(value)
  }

  static fail<E>(error: E): Exit<E, never> {
    return new Failure(new Fail(error))
  }

  static failCause<E>(cause: Cause<E>): Exit<E, never> {
    return new Failure(cause)
  }

  abstract fold<B>(
    ifFailure: (_: Failure<E>) => B,
    ifSuccess: (_: Success<A>) => B
  ): B

  abstract map<B>(f: (_: A) => B): Exit<E, B>

  abstract flatMap<E1, A1>(f: (_: A) => Exit<E1, A1>): Exit<E | E1, A1>

  zip<E1, A1>(that: Exit<E1, A1>): Exit<E | E1, [A, A1]> {
    return this.zipWith(
      that,
      (a, b) => [a, b],
      (a, b) => (a as Cause<E | E1>).then(b)
    )
  }

  zipLeft<E1, A1>(that: Exit<E1, A1>): Exit<E | E1, A> {
    return this.zipWith(
      that,
      (a, _) => a,
      (a, b) => (a as Cause<E | E1>).then(b)
    )
  }

  zipRight<E1, A1>(that: Exit<E1, A1>): Exit<E | E1, A1> {
    return this.zipWith(
      that,
      (_, a1) => a1,
      (a, b) => (a as Cause<E | E1>).then(b)
    )
  }

  abstract zipWith<E1, A1, C>(
    that: Exit<E1, A1>,
    f: (a: A, b: A1) => C,
    g: (a: Cause<E>, b: Cause<E1>) => Cause<E | E1>
  ): Exit<E | E1, C>

  isSuccess(): boolean {
    return this.fold(
      _ => false,
      _ => true
    )
  }

  toUnion(): A | Cause<E> {
    return this.fold<A | Cause<E>>(
      _ => _.cause,
      _ => _.value
    )
  }

  orNull(): A | null {
    return this.fold(
      _ => null,
      _ => _.value
    )
  }

  orUndefined(): A | undefined {
    return this.fold(
      _ => undefined,
      _ => _.value
    )
  }
}

export class Success<A> extends Exit<never, A> {
  zipWith<E1, A1, C>(
    that: Exit<E1, A1>,
    f: (a: A, b: A1) => C,
    _: (a: Cause<never>, b: Cause<E1>) => Cause<E1>
  ): Exit<E1, C> {
    return that.fold<Exit<E1, C>>(
      _ => _,
      _ => _.map(value => f(this.value, value))
    )
  }

  constructor(value: A) {
    super()
    this.value = value
  }

  value: A

  fold<B>(_: (_: Failure<never>) => B, ifSuccess: (_: Success<A>) => B): B {
    return ifSuccess(this)
  }

  map<B>(f: (_: A) => B): Exit<never, B> {
    return new Success(f(this.value))
  }

  flatMap<E1, A1>(f: (_: A) => Exit<E1, A1>): Exit<E1, A1> {
    return f(this.value)
  }
}

class Failure<E> extends Exit<E, never> {
  constructor(cause: Cause<E>) {
    super()
    this.cause = cause
  }

  cause: Cause<E>

  fold<B>(ifFailure: (_: Failure<E>) => B, _: (_: Success<never>) => B): B {
    return ifFailure(this)
  }

  map<B>(_: (_: never) => B): Exit<E, B> {
    return this
  }
  flatMap<E1, A1>(_: (_: never) => Exit<E1, A1>): Exit<E | E1, A1> {
    return this
  }
  zipWith<E1, A1, C>(
    that: Exit<E1, A1>,
    _: (a: never, b: A1) => C,
    g: (a: Cause<E>, b: Cause<E1>) => Cause<E | E1>
  ): Exit<E | E1, C> {
    return that.fold<Exit<E | E1, C>>(
      _ => new Failure(g(this.cause, _.cause)),
      _ => this
    )
  }
}

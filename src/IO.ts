import { Both, Cause, Die, Fail, Then } from './models/Cause'
import { Exit } from './models/Exit'
import { Fiber } from './models/Fiber'
import { FiberContext } from './models/FiberContext'
import { Tag, Tags } from './models/Tag'

abstract class IO<E, A> {
  abstract tag: Tag

  static async<A1>(register: (_: (_: A1) => any) => any): IO<never, A1> {
    return new Async(register)
  }

  static attempt<B>(f: () => B): IO<unknown, B> {
    return IO.succeedNow(f).flatMap(unsafe => {
      try {
        return IO.succeedNow(unsafe())
      } catch (error) {
        return IO.fail(() => error)
      }
    })
  }

  static die(reason: unknown): IO<never, never> {
    return new Failure(() => new Die(reason))
  }

  static succeed<B>(value: () => B): IO<never, B> {
    return new Succeed(value)
  }

  static sleep(ms: number): IO<never, void> {
    return IO.async(callback => setTimeout(() => callback(), ms))
  }

  static unit(): IO<never, void> {
    return new Succeed(() => {})
  }

  static fail<E1>(error: () => E1): IO<E1, never> {
    return this.failCause(() => new Fail(error()))
  }

  static failCause<E1>(error: () => Cause<E1>): IO<E1, never> {
    return new Failure(error)
  }

  static fromExit<E1, A1>(exit: Exit<E1, A1>): IO<E1, A1> {
    return exit.fold<IO<E1, A1>>(
      _ => new Failure(() => _.cause),
      _ => new SucceedNow(_.value)
    )
  }

  static fromPromise<B>(promise: () => Promise<B>): IO<unknown, B> {
    return IO.succeed(promise)
      .flatMap(p =>
        IO.async<Exit<unknown, B>>(complete =>
          p
            .then(result => complete(Exit.succeed(result)))
            .catch(error => complete(Exit.fail(error)))
        )
      )
      .flatMap(IO.fromExit)
  }

  static scheduleOnce<E1, A1>(effect: IO<E1, A1>): (ms: number) => IO<E1, A1> {
    return ms => IO.sleep(ms).flatMap(() => effect)
  }

  private static succeedNow<B>(value: B): IO<never, B> {
    return new SucceedNow(value)
  }

  as<B>(that: () => B): IO<E, B> {
    return this.map(_ => that())
  }

  asPure<B>(b: B): IO<E, B> {
    return this.map(_ => b)
  }

  catchAll<E1, B>(f: (_: E) => IO<E1, B>): IO<E1, A | B> {
    return this.foldIO<E1, A | B>(f, IO.succeedNow)
  }

  catchAllCause<E1, B>(f: (_: Cause<E>) => IO<E1, B>): IO<E1, A | B> {
    return this.foldIOCause<E1, A | B>(f, IO.succeedNow)
  }

  ensuring(f: () => void): IO<E, A> {
    return this.foldIOCause(
      cause => {
        f()
        return IO.failCause(() => cause)
      },
      success => {
        f()
        return IO.succeedNow(success)
      }
    )
  }

  flatMap<E1, A1>(f: (_: A) => IO<E1, A1>): IO<E | E1, A1> {
    return new FlatMap(this, f)
  }

  foldIOCause<P, Q>(
    failure: (_: Cause<E>) => IO<P, Q>,
    success: (_: A) => IO<P, Q>
  ): IO<P, Q> {
    return new Fold(this, failure, success)
  }

  fold<B>(failure: (_: E) => B, success: (_: A) => B): IO<never, B> {
    return this.foldIO(
      e => IO.succeedNow(failure(e)),
      a => IO.succeedNow(success(a))
    )
  }

  foldCause<B>(
    failure: (_: Cause<E>) => B,
    success: (_: A) => B
  ): IO<never, B> {
    return this.foldIOCause(
      c => IO.succeedNow(failure(c)),
      a => IO.succeedNow(success(a))
    )
  }

  foldIO<P, Q>(
    failure: (_: E) => IO<P, Q>,
    success: (_: A) => IO<P, Q>
  ): IO<P, Q> {
    return this.foldIOCause(
      cause =>
        cause.fold(
          e => failure(e.error),
          die => IO.failCause(() => die),
          interrupt => IO.failCause(() => interrupt),
          then =>
            IO.failCause(() => then.left)
              .foldIO(failure, success)
              .foldIOCause(
                left =>
                  IO.failCause(() => then.right)
                    .foldIO(failure, success)
                    .foldIOCause(
                      right => IO.failCause(() => new Then(left, right)),
                      IO.succeedNow
                    ),
                IO.succeedNow
              ),
          both =>
            IO.failCause(() => both.left)
              .foldIO(failure, success)
              .foldIOCause(
                left =>
                  IO.failCause(() => both.right)
                    .foldIO(failure, success)
                    .foldIOCause(
                      right => IO.failCause(() => new Both(left, right)),
                      IO.succeedNow
                    ),
                IO.succeedNow
              )
        ),
      success
    )
  }

  fork(): IO<never, Fiber<E, A>> {
    return new Fork(this)
  }

  ignore(): IO<never, void> {
    return this.foldIO(
      _ => IO.unit(),
      _ => IO.unit()
    )
  }

  map<B>(f: (_: A) => B): IO<E, B> {
    return this.flatMap(a => IO.succeedNow(f(a)))
  }

  mapError<B>(f: (_: E) => B): IO<B, A> {
    return this.foldIO(e => IO.fail(() => f(e)), IO.succeedNow)
  }

  orElse<E1, A1>(that: IO<E1, A1>): IO<E1, A | A1> {
    return this.foldIO<E1, A | A1>(_ => that, IO.succeedNow)
  }

  orElseSucceed<B>(b: () => B): IO<never, A | B> {
    return this.orElse(IO.succeed(b))
  }

  orElseFail<B>(error: () => B): IO<B, A> {
    return this.mapError(_ => error())
  }

  orElseFailPure<B>(error: B): IO<B, A> {
    return this.mapError(_ => error)
  }

  orUndefined(): IO<never, A | undefined> {
    return this.catchAll(_ => IO.succeedNow(undefined))
  }

  orNull(): IO<never, A | null> {
    return this.catchAll(_ => IO.succeedNow(null))
  }

  orDie(): IO<never, A> {
    return this.foldIO(e => IO.failCause(() => new Die(e)), IO.succeedNow)
  }

  repeat(n: number): IO<E, void> {
    if (n <= 0) {
      return IO.unit()
    } else {
      return this.flatMap(_ => this.repeat(n - 1))
    }
  }

  tap(f: (a: A) => void): IO<E, A> {
    return this.flatMap(a => {
      try {
        f(a)
      } finally {
      }
      return IO.succeedNow(a)
    })
  }

  tapIO(f: (a: A) => IO<any, any>): IO<E, A> {
    return this.flatMap(a => {
      f(a).unsafeRun()
      return IO.succeedNow(a)
    })
  }

  zip<E1, A1>(that: IO<E1, A1>): IO<E | E1, [A, A1]> {
    return this.flatMap(a => that.flatMap(b => IO.succeedNow([a, b])))
  }

  zipPar<E1, A1>(that: IO<E1, A1>): IO<E | E1, [A, A1]> {
    return this.fork().flatMap(selfFiber =>
      that.flatMap(b => selfFiber.join().map(a => [a, b]))
    )
  }

  zipRight<E1, A1>(that: IO<E1, A1>): IO<E | E1, A1> {
    return this.zipWith(that)(t => t[1])
  }

  zipLeft<E1, A1>(that: IO<E1, A1>): IO<E | E1, A> {
    return this.zipWith(that)(t => t[0])
  }

  zipWith<E1, A1>(
    that: IO<E1, A1>
  ): <C>(_: (_: [A, A1]) => C) => IO<E | E1, C> {
    return f => this.flatMap(a => that.map(b => f([a, b])))
  }

  private unsafeRunFiber(): Fiber<E, A> {
    return new FiberContext(this)
  }

  unsafeRun(): Promise<Exit<E, A>> {
    const fiber = this.unsafeRunFiber()
    return fiber.executor
  }

  unsafeRunToPromise(): Promise<A> {
    return this.unsafeRun().then(exit =>
      exit.fold(
        failure =>
          failure.cause.fold(
            fail => Promise.reject(fail),
            reason => Promise.reject(`FATAL ERROR: FIBER DIED: ${reason}}`),
            () => Promise.reject('Fiber interrupted.'),
            then =>
              Promise.reject(`Sequential failures: ${JSON.stringify(then)}`),
            both => Promise.reject(`Parallel failures: ${JSON.stringify(both)}`)
          ),
        success => Promise.resolve(success.value)
      )
    )
  }
}

export class Fold<E, A, P, Q> extends IO<P, Q> {
  constructor(
    io: IO<E, A>,
    onFailure: (_: Cause<E>) => IO<P, Q>,
    onSuccess: (_: A) => IO<P, Q>
  ) {
    super()
    this.io = io
    this.onSuccess = onSuccess
    this.onFailure = onFailure
  }

  tag: Tag = Tags.fold

  io: IO<E, A>
  onSuccess: (_: A) => IO<P, Q>
  onFailure: (_: Cause<E>) => IO<P, Q>
}

export class Async<A> extends IO<never, A> {
  constructor(register: (_: (_: A) => any) => any) {
    super()
    this.register = register
  }

  register: (_: (_: A) => any) => any

  tag: Tag = Tags.async
}

export class Fork<E, A> extends IO<never, Fiber<E, A>> {
  constructor(effect: IO<E, A>) {
    super()
    this.effect = effect
  }

  effect: IO<E, A>

  tag: Tag = Tags.fork
}

export class Failure<E> extends IO<E, never> {
  constructor(cause: () => Cause<E>) {
    super()
    this.cause = cause
  }

  cause: () => Cause<E>

  tag: Tag = Tags.failure
}

export class SucceedNow<A> extends IO<never, A> {
  constructor(a: A) {
    super()
    this.value = a
  }

  value: A

  tag: Tag = Tags.succeedNow
}

export class Succeed<A> extends IO<never, A> {
  constructor(a: () => A) {
    super()
    this.thunk = a
  }

  thunk: () => A

  tag: Tag = Tags.succeed
}

export class FlatMap<E0, E1, A0, A1> extends IO<E0 | E1, A1> {
  constructor(effect: IO<E0, A0>, continuation: (_: A0) => IO<E1, A1>) {
    super()
    this.effect = effect
    this.continuation = continuation
  }

  effect: IO<E0, A0>
  continuation: (_: A0) => IO<E1, A1>

  tag: Tag = Tags.flatMap
}

export { IO, Exit }

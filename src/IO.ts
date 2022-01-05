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

  static unit(): IO<never, void> {
    return new Succeed(() => {})
  }

  static fail<E1>(error: () => E1): IO<E1, never> {
    return this.failCause(() => new Fail(error()))
  }

  static failPure<E1>(error: E1): IO<E1, never> {
    return this.failCause(() => new Fail(error))
  }

  static failCause<E1>(error: () => Cause<E1>): IO<E1, never> {
    return new Failure(error)
  }

  static failCausePure<E1>(error: Cause<E1>): IO<E1, never> {
    return new Failure(() => error)
  }

  static fromCallbacks<E1, A1>(
    executor: (resolve: (_: A1) => any, reject: (_: E1) => any) => any
  ): IO<E1, A1> {
    return IO.succeedNow(executor)
      .flatMap(exec =>
        IO.async<Exit<E1, A1>>(complete =>
          exec(
            a => complete(Exit.succeed(a)),
            e => complete(Exit.fail(e))
          )
        )
      )
      .flatMap(IO.fromExit)
  }

  static fromExit<E1, A1>(exit: Exit<E1, A1>): IO<E1, A1> {
    return exit.fold<IO<E1, A1>>(
      _ => new Failure(() => _.cause),
      _ => new SucceedNow(_.value)
    )
  }

  static fromNull<B>(b: () => B | null): IO<null, B> {
    return IO.succeed(b).flatMap(_ =>
      _ === null ? IO.fail(() => null) : IO.succeedNow(_)
    )
  }

  static fromUndefined<B>(b: () => B | undefined): IO<undefined, B> {
    return IO.succeed(b).flatMap(_ =>
      _ === undefined ? IO.fail(() => undefined) : IO.succeedNow(_)
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

  static succeed<B>(value: () => B): IO<never, B> {
    return new Succeed(value)
  }

  static succeedPure<B>(value: B): IO<never, B> {
    return IO.succeedNow(value)
  }

  static sleep(ms: number): IO<never, void> {
    return IO.async(callback => setTimeout(() => callback(), ms))
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
    return this.foldCauseIO<E1, A | B>(f, IO.succeedNow)
  }

  ensuring(f: () => void): IO<E, A> {
    return this.foldCauseIO(
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
    return this.foldCauseIO(
      c => IO.succeedNow(failure(c)),
      a => IO.succeedNow(success(a))
    )
  }

  foldIO<P, Q>(
    failure: (_: E) => IO<P, Q>,
    success: (_: A) => IO<P, Q>
  ): IO<P, Q> {
    return this.foldCauseIO(
      cause =>
        cause.fold(
          e => failure(e.error),
          die => IO.failCause(() => die),
          interrupt => IO.failCause(() => interrupt),
          then =>
            IO.failCause(() => then.left)
              .foldIO(failure, success)
              .foldCauseIO(
                left =>
                  IO.failCause(() => then.right)
                    .foldIO(failure, success)
                    .foldCauseIO(
                      right => IO.failCause(() => new Then(left, right)),
                      IO.succeedNow
                    ),
                IO.succeedNow
              ),
          both =>
            IO.failCause(() => both.left)
              .foldIO(failure, success)
              .foldCauseIO(
                left =>
                  IO.failCause(() => both.right)
                    .foldIO(failure, success)
                    .foldCauseIO(
                      right => IO.failCause(() => new Both(left, right)),
                      IO.succeedNow
                    ),
                IO.succeedNow
              )
        ),
      success
    )
  }

  foldCauseIO<P, Q>(
    failure: (_: Cause<E>) => IO<P, Q>,
    success: (_: A) => IO<P, Q>
  ): IO<P, Q> {
    return new Fold(this, failure, success)
  }

  forever(): IO<E, never> {
    return this.zipRight(this.forever())
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
    return this.tapIO(a => IO.succeed(() => f(a)))
  }

  tapIO<E1, A1>(f: (a: A) => IO<E1, A1>): IO<E, A> {
    return this.flatMap(a => f(a).ignore().zipRightPar(IO.succeedNow(a)))
  }

  tapBoth<A1, A2>(onSuccess: (_: A) => A1, onFailure: (_: E) => A2): IO<E, A> {
    return this.tapBothIO(
      a => IO.succeed(() => onSuccess(a)),
      e => IO.succeed(() => onFailure(e))
    )
  }

  tapBothIO<E1, A1, E2, A2>(
    onSuccess: (_: A) => IO<E1, A1>,
    onFailure: (_: E) => IO<E2, A2>
  ): IO<E, A> {
    const computeIfError = <B, C>(
      cause: Cause<B>,
      f: (_: B) => C,
      g: (_: Cause<B>) => C,
      monoidC: (a: C, b: C) => C
    ): C =>
      cause.fold(
        fail => f(fail.error),
        die => g(die),
        interrupt => g(interrupt),
        then =>
          monoidC(
            computeIfError(then.left, f, g, monoidC),
            computeIfError(then.right, f, g, monoidC)
          ),
        both =>
          monoidC(
            computeIfError(both.left, f, g, monoidC),
            computeIfError(both.right, f, g, monoidC)
          )
      )
    return this.tapBothCauseIO(onSuccess, cause =>
      cause
        .fold(
          fail => onFailure(fail.error).ignore(),
          _ => IO.unit(),
          _ => IO.unit(),
          then =>
            computeIfError(
              then,
              e => onFailure(e).ignore(),
              _ => IO.unit(),
              (a, b) => a.zipPar(b).ignore()
            ),
          both =>
            computeIfError(
              both,
              e => onFailure(e).ignore(),
              _ => IO.unit(),
              (a, b) => a.zipPar(b).ignore()
            )
        )
        .zipRightPar(IO.failCausePure(cause))
    )
  }

  tapBothCause<A1, A2>(
    onSuccess: (_: A) => A1,
    onFailure: (_: Cause<E>) => A2
  ): IO<E, A> {
    return this.tapBothCauseIO(
      a => IO.succeed(() => onSuccess(a)),
      cause => IO.succeed(() => onFailure(cause))
    )
  }

  tapBothCauseIO<E1, A1, E2, A2>(
    onSuccess: (_: A) => IO<E1, A1>,
    onFailure: (_: Cause<E>) => IO<E2, A2>
  ): IO<E, A> {
    return this.foldCauseIO(
      cause => onFailure(cause).ignore().zipRightPar(IO.failCausePure(cause)),
      success => onSuccess(success).ignore().zipRightPar(IO.succeedNow(success))
    )
  }

  zip<E1, A1>(that: IO<E1, A1>): IO<E | E1, [A, A1]> {
    return this.flatMap(a => that.flatMap(b => IO.succeedNow([a, b])))
  }

  zipPar<E1, A1>(that: IO<E1, A1>): IO<E | E1, [A, A1]> {
    return this.zipWithPar(that)((a, b) => [a, b])
  }

  zipRight<E1, A1>(that: IO<E1, A1>): IO<E | E1, A1> {
    return this.zipWith(that)((_, b) => b)
  }

  zipRightPar<E1, A1>(that: IO<E1, A1>): IO<E | E1, A1> {
    return this.zipWithPar(that)((_, b) => b)
  }

  zipLeft<E1, A1>(that: IO<E1, A1>): IO<E | E1, A> {
    return this.zipWith(that)((a, _) => a)
  }

  zipLeftPar<E1, A1>(that: IO<E1, A1>): IO<E | E1, A> {
    return this.zipWith(that)((a, _) => a)
  }

  zipWith<E1, A1>(
    that: IO<E1, A1>
  ): <C>(_: (a: A, b: A1) => C) => IO<E | E1, C> {
    return f => this.flatMap(a => that.map(b => f(a, b)))
  }

  zipWithPar<E1, A1>(
    that: IO<E1, A1>
  ): <C>(_: (a: A, b: A1) => C) => IO<E | E1, C> {
    return f =>
      this.fork().flatMap(selfFiber =>
        that.flatMap(b => selfFiber.join().map(a => f(a, b)))
      )
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

export { IO, Exit, Fiber }

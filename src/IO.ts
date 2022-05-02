import { Cause, Die, Fail } from './models/Cause'
import { Exit } from './models/Exit'
import { Fiber } from './models/Fiber'
import { FiberContext } from './models/FiberContext'
import {
  Interruptible,
  InterruptStatus,
  Uninterruptible
} from './models/InterruptStatus'
import { Tag, Tags } from './models/Tag'

abstract class IO<E, A> {

  private static __unit__: IO<never, void> | null = null

  abstract tag: Tag

  static async<E1, A1>(register: (_: (_: IO<E1, A1>) => any) => any): IO<never, A1> {
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
    if (IO.__unit__ === null) {
      IO.__unit__ = new Succeed(() => { })
    }
    return IO.__unit__
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

  static printLine(line: any): IO<never, void> {
    return IO.succeed(() => console.log(line))
  }

  static poll<E1, A1>(
    io: IO<E1, A1>,
    shouldSucceed: (_: A1) => boolean,
    pollInterval: number
  ): IO<E1, A1> {
    return io.flatMap(a => {
      if (shouldSucceed(a)) {
        return IO.succeedNow(a)
      } else {
        return IO.sleep(pollInterval).zipRight(
          this.poll(io, shouldSucceed, pollInterval)
        )
      }
    })
  }

  static fromCallbacks<E1, A1>(
    executor: (resolve: (_: A1) => any, reject: (_: E1) => any) => any
  ): IO<E1, A1> {
    return IO.succeedNow(executor)
      .flatMap(exec =>
        IO.async<E1, A1>(complete =>
          exec(
            a => complete(IO.succeedNow(a)),
            e => complete(IO.failPure(e))
          )
        )
      )
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
        IO.async<unknown, B>(complete =>
          p
            .then(result => complete(IO.succeedNow(result)))
            .catch(error => complete(IO.fail(error)))
        )
      )
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
    return IO.async(callback => {
      setTimeout(() => {
        callback(IO.unit())
      }, ms)
    })
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

  ensuring(finalizer: IO<never, any>): IO<E, A> {
    return this.foldCauseIO(
      cause => finalizer.zipRight(IO.failCausePure(cause)),
      success => finalizer.zipRight(IO.succeedNow(success))
    )
  }

  exit(): IO<never, Exit<E, A>> {
    return this.foldCause<Exit<E, A>>(
      cause => Exit.failCause(cause),
      a => Exit.succeed(a)
    )
  }

  flatMap<E1, A1>(f: (_: A) => IO<E1, A1>): IO<E | E1, A1> {
    return new FlatMap(this, f)
  }

  flatten(): A extends IO<infer E1, infer A1> ? IO<E | E1, A1> : never {
    return this.flatMap(a => {
      if (a instanceof IO) {
        return a
      } else {
        throw new Error(`${a} is not an IO`)
      }
    }) as any
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
    return this.foldCauseIO(cause => cause.foldFailureOrCause(failure, _ => IO.failCausePure(_ as Cause<never>)), success)
  }

  foldCauseIO<P, Q>(
    failure: (_: Cause<E>) => IO<P, Q>,
    success: (_: A) => IO<P, Q>
  ): IO<P, Q> {
    return new Fold(this, failure, success)
  }

  forever(): IO<E, never> {
    return this.flatMap(_ => this.forever())
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

  interruptStatus(flag: InterruptStatus): IO<E, A> {
    return new SetInterruptStatus(this, flag)
  }

  interruptible(): IO<E, A> {
    return this.interruptStatus(Interruptible)
  }

  uninterruptible(): IO<E, A> {
    return this.interruptStatus(Uninterruptible)
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

  onExit(f: (_: Exit<E, A>) => IO<never, any>): IO<E, A> {
    return this.tapBothCauseIO(cause => f(Exit.failCause(cause)), a => f(Exit.succeed(a)))
  }

  race<E1, A1>(that: IO<E1, A1>): IO<E | E1, A | A1> {
    return this.fork().zip(that.fork()).flatMap(
      tupled => IO.async<never, A | A1>(complete => {
        {
          const [f1, f2] = tupled
          const self = f1.join().tapIO(a => f2.interrupt().tap(_ => complete(IO.succeedNow(a))))
          const other = f2.join().tapIO(a1 => f1.interrupt().tap(_ => complete(IO.succeedNow(a1))))
          self.zipPar(other).unsafeRunFiber()
        }
      })
    )
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

  tapIO<E1, A1>(f: (a: A) => IO<E1, A1>): IO<E | E1, A> {
    return this.flatMap(a => f(a).asPure(a))
  }

  tapBoth<A1, A2>(onFailure: (_: E) => A2, onSuccess: (_: A) => A1): IO<E, A> {
    return this.tapBothIO(
      e => IO.succeed(() => onFailure(e)),
      a => IO.succeed(() => onSuccess(a))
    )
  }

  tapBothIO<E1, A1, E2, A2>(
    onFailure: (_: E) => IO<E2, A2>,
    onSuccess: (_: A) => IO<E1, A1>
  ): IO<E | E1 | E2, A> {
    return this.tapBothCauseIO(cause => cause.foldFailureOrCause(onFailure, _ => IO.failCausePure(_ as Cause<never>)), onSuccess)
  }

  tapBothCause<A1, A2>(
    onFailure: (_: Cause<E>) => A2,
    onSuccess: (_: A) => A1
  ): IO<E, A> {
    return this.tapBothCauseIO(
      cause => IO.succeed(() => onFailure(cause)),
      a => IO.succeed(() => onSuccess(a)),
    )
  }

  tapBothCauseIO<E1, A1, E2, A2>(
    onFailure: (_: Cause<E>) => IO<E2, A2>,
    onSuccess: (_: A) => IO<E1, A1>
  ): IO<E | E1 | E2, A> {
    return this.foldCauseIO<E | E1 | E2, A>(
      cause => onFailure(cause).zipRight(IO.failCausePure(cause)),
      success => onSuccess(success).zipRight(IO.succeedNow(success))
    )
  }

  zip<E1, A1>(that: IO<E1, A1>): IO<E | E1, [A, A1]> {
    return this.flatMap(a => that.flatMap(b => IO.succeedNow([a, b])))
  }

  zipLazy<E1, A1>(that: () => IO<E1, A1>): IO<E | E1, [A, A1]> {
    return this.flatMap(a => that().flatMap(b => IO.succeedNow([a, b])))
  }

  zipPar<E1, A1>(that: IO<E1, A1>): IO<E | E1, [A, A1]> {
    return this.zipWithPar(that)((a, b) => [a, b])
  }

  zipParLazy<E1, A1>(that: () => IO<E1, A1>): IO<E | E1, [A, A1]> {
    return this.zipWithParLazy(that)((a, b) => [a, b])
  }

  zipRight<E1, A1>(that: IO<E1, A1>): IO<E | E1, A1> {
    return this.zipWith(that)((_, b) => b)
  }

  zipRightLazy<E1, A1>(that: () => IO<E1, A1>): IO<E | E1, A1> {
    return this.zipWithLazy(that)((_, b) => b)
  }

  zipRightPar<E1, A1>(that: IO<E1, A1>): IO<E | E1, A1> {
    return this.zipWithPar(that)((_, b) => b)
  }

  zipRightParLazy<E1, A1>(that: () => IO<E1, A1>): IO<E | E1, A1> {
    return this.zipWithParLazy(that)((_, b) => b)
  }

  zipLeft<E1, A1>(that: IO<E1, A1>): IO<E | E1, A> {
    return this.zipWith(that)((a, _) => a)
  }

  zipLeftLazy<E1, A1>(that: () => IO<E1, A1>): IO<E | E1, A> {
    return this.zipWithLazy(that)((a, _) => a)
  }

  zipLeftPar<E1, A1>(that: IO<E1, A1>): IO<E | E1, A> {
    return this.zipWith(that)((a, _) => a)
  }

  zipLeftParLazy<E1, A1>(that: () => IO<E1, A1>): IO<E | E1, A> {
    return this.zipWithParLazy(that)((a, _) => a)
  }

  zipWith<E1, A1>(
    that: IO<E1, A1>
  ): <C>(_: (a: A, b: A1) => C) => IO<E | E1, C> {
    return f => this.flatMap(a => that.map(b => f(a, b)))
  }

  zipWithLazy<E1, A1>(
    that: () => IO<E1, A1>
  ): <C>(_: (a: A, b: A1) => C) => IO<E | E1, C> {
    return f => this.flatMap(a => that().map(b => f(a, b)))
  }

  zipWithPar<E1, A1>(
    that: IO<E1, A1>
  ): <C>(_: (a: A, b: A1) => C) => IO<E | E1, C> {
    return f =>
      this.fork().flatMap(selfFiber =>
        that.flatMap(b => selfFiber.join().map(a => f(a, b)))
      )
  }

  zipWithParLazy<E1, A1>(
    that: () => IO<E1, A1>
  ): <C>(_: (a: A, b: A1) => C) => IO<E | E1, C> {
    return f =>
      this.fork().flatMap(selfFiber =>
        that().flatMap(b => selfFiber.join().map(a => f(a, b)))
      )
  }

  abstract toString(): string

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

  toString(): string {
    return `Fold(${this.io.toString()}, onSuccess = ${this.onSuccess
      }, onFailure = Fn)`
  }
}

export class Async<E, A> extends IO<never, A> {
  constructor(register: (_: (_: IO<E, A>) => any) => any) {
    super()
    this.register = register
  }

  register: (_: (_: IO<E, A>) => any) => any

  tag: Tag = Tags.async

  toString(): string {
    return `Async(Fn)`
  }
}

export class Fork<E, A> extends IO<never, Fiber<E, A>> {
  constructor(effect: IO<E, A>) {
    super()
    this.effect = effect
  }

  effect: IO<E, A>

  tag: Tag = Tags.fork

  toString(): string {
    return `Fork(${this.effect.toString()})`
  }
}

export class SetInterruptStatus<E, A> extends IO<E, A> {
  constructor(effect: IO<E, A>, interruptStatus: InterruptStatus) {
    super()
    this.effect = effect
    this.status = interruptStatus
  }

  status: InterruptStatus
  effect: IO<E, A>

  tag: Tag = Tags.setInterruptStatus

  toString(): string {
    return `SetInterrupt(${this.effect.toString()}, ${this.status.isInterruptible
      })`
  }
}

export class Failure<E> extends IO<E, never> {
  constructor(cause: () => Cause<E>) {
    super()
    this.cause = cause
  }

  cause: () => Cause<E>

  tag: Tag = Tags.failure

  toString(): string {
    return `Failure(Fn)`
  }
}

export class SucceedNow<A> extends IO<never, A> {
  constructor(a: A) {
    super()
    this.value = a
  }

  value: A

  tag: Tag = Tags.succeedNow

  toString(): string {
    return `SucceedNow(${this.value})`
  }
}

export class Succeed<A> extends IO<never, A> {
  constructor(a: () => A) {
    super()
    this.thunk = a
  }

  thunk: () => A

  tag: Tag = Tags.succeed

  toString(): string {
    return `Succeed(${this.thunk})`
  }
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

  toString(): string {
    return `FlatMap(${this.effect.toString()}, ${this.continuation})`
  }
}

export { IO, Exit, Fiber }

import { ExponentialWithBackoff } from './models/Retry/ExponentialWithBackoff'
import { RetryPolicies, RetryPolicy } from './models/Retry/RetryPolicy'
import { Spaced } from './models/Retry/Spaced'
import { TimeoutError } from './models/TimeoutError'

type Resolve<A> = (a: A | PromiseLike<A>) => void
type Reject = (reason: unknown) => void

export type InProgress = 'in_progress'

export interface Timed<A> {
  result: A
  duration: number
}

export class IO<A> {
  private thunk: () => Promise<A>

  constructor(body: (resolve: Resolve<A>, reject: Reject) => void) {
    this.thunk = () => new Promise<A>(body)
  }

  /** 
    Collect the result of running many effects in parallel in an array.
    */
  static collectPar<B>(promises: IO<B>[]): IO<B[]> {
    return IO.fromThunk(() => Promise.all(promises.map(_ => _.run())))
  }

  /** 
    Create an effect that fails upon running.
    */
  static fail<B>(failure: unknown): IO<B> {
    return IO.fromThunk(() => Promise.reject(failure))
  }

  /** 
    Traverse an array of items with a function that produces an effect.
    */
  static foreachPar<B, C>(b: B[], f: (_: B) => IO<C>): IO<C[]> {
    return IO.collectPar<C>(b.map(_ => IO.safeInvoke(_, f)))
  }

  /**
    Try lifting a pure value that is potentially null into an effect which will fail
    if null was encountered.
    */
  static fromNull<B>(b: B | null): IO<B> {
    return b === null ? IO.fail('Null encountered') : IO.succeed(b)
  }

  /**
    Try lifting a pure value that is potentially undefined into an effect which will fail
    if undefined was encountered.
    */
  static fromUndefined<B>(b: B | undefined): IO<B> {
    return b === undefined ? IO.fail('Undefined encountered') : IO.succeed(b)
  }

  /** 
    Create an effect from a thunk that returns a promise.
    */
  static fromThunk<B>(thunk: () => Promise<B>): IO<B> {
    return new IO<B>((resolve, reject) => {
      try {
        thunk().then(resolve).catch(reject)
      } catch (err) {
        reject(err)
      }
    })
  }

  /** 
    Create an effect from a function that may throw an exception.
    */
  static fromThunkSync<B>(thunk: () => B): IO<B> {
    return new IO<B>((resolve, reject) => {
      try {
        const result = thunk()
        resolve(result)
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   Invoke a function that returns an effect. Exceptions will be lifted into failures.
   */
  static safeInvoke<B, C>(b: B, f: (_: B) => IO<C>): IO<C> {
    try {
      return f(b)
    } catch (err) {
      return IO.fail<C>(err)
    }
  }

  /** 
    Create an effect that succeeds after the specified time.
    */
  static sleep(ms: number): IO<void> {
    return IO.fromThunk(
      () =>
        new Promise<void>((resolve, _) => {
          setTimeout(resolve, ms)
        })
    )
  }

  /** 
    Create an effect from a pure value.
    */
  static succeed<B>(b: B): IO<B> {
    return IO.fromThunk(() => Promise.resolve(b))
  }

  /** 
    Run an effect until it succeeds with its value.
    The original effect must either succeed with a value or `InProgress`
    */
  static poll<B>(f: IO<B | InProgress>, pollInterval: number): IO<B> {
    const thunk = (): Promise<B> =>
      new Promise<B>((resolve, _) => {
        f.run().then(maybeResult => {
          if (maybeResult === 'in_progress') {
            setTimeout(() => {
              thunk().then(a => resolve(a))
            }, pollInterval)
          } else {
            resolve(maybeResult)
          }
        })
      })

    return IO.fromThunk(thunk)
  }

  /** 
    Retries a thunk that returns a promise using the specified RetryPolicy.
    This method is unsafe and will run the effect.
    */
  private static withRetries<B>(
    thunk: () => Promise<B>,
    policy: RetryPolicy
  ): Promise<B> {
    if (policy.maxRetries < 0) {
      return Promise.reject('Retries exceeded')
    } else {
      return new Promise<B>((resolve, reject) => {
        thunk()
          .then(resolve)
          .catch(error => {
            if (policy.maxRetries === 0) {
              reject(error)
            } else {
              if (policy instanceof Spaced) {
                setTimeout(() => {
                  resolve(
                    IO.withRetries(
                      thunk,
                      RetryPolicies.spaced(
                        policy.interval,
                        policy.maxRetries - 1
                      )
                    )
                  )
                }, policy.interval)
              } else if (policy instanceof ExponentialWithBackoff) {
                setTimeout(() => {
                  resolve(
                    IO.withRetries(
                      thunk,
                      RetryPolicies.exponentialWithBackoff(
                        policy.initialInterval * policy.base,
                        policy.maxRetries - 1,
                        policy.base
                      )
                    )
                  )
                }, policy.initialInterval)
              } else {
                reject('Unknown retry policy')
              }
            }
          })
      })
    }
  }

  /**
    Add a finalizer to this effect that will run regardless of failure or success.
    */
  ensuring(f: () => void): IO<A> {
    return IO.fromThunk(() => this.thunk().finally(f))
  }

  /** 
    Sequence another effect, using the success value of this effect.
    */
  flatMap<B>(f: (a: A) => IO<B>): IO<B> {
    return IO.fromThunk(() => this.thunk().then(_ => f(_).run()))
  }

  /** 
    Transform this effect to a different type based on its success value or the produced error.
    The transformations must be pure. For an effectful transformation use foldM.
    */
  fold<B>(onFailure: (_: unknown) => B, onSuccess: (_: A) => B): IO<B> {
    return this.flatMap(a => IO.fromThunkSync(() => onSuccess(a))).recoverWith(
      err => IO.fromThunkSync(() => onFailure(err))
    )
  }

  /** 
    Effectfully transform this effect to a different type based on its success value or the produced error.
    The transformations must return an IO. For a pure transformation use fold.
    */
  foldM<B>(
    onFailure: (_: unknown) => IO<B>,
    onSuccess: (_: A) => IO<B>
  ): IO<B> {
    return this.flatMap(onSuccess).recoverWith(onFailure)
  }

  /**
    Transform the success value of this effect.
    The transformation must be pure. For an effectful transformation use flatMap.
    */
  map<B>(f: (a: A) => B): IO<B> {
    return IO.fromThunk(() => this.thunk().then(f))
  }

  /**
    Transform the error produced by this effect.
    The transformation must be pure. For an effectful transformation use recoverWith.
    */
  mapError<B>(f: (_: unknown) => B) {
    return IO.fromThunk(() =>
      this.thunk().catch(error => Promise.reject(f(error)))
    )
  }

  /**
    Create an effect that succeeds with succeess value of this effect or another effect, whichever finishes first.
    Note that since Promise cannot be cancelled, the finalizers of both effects will have to run regardless of
    which one wins. You can get around this by attaching the finalizer to the effect produced by race.
    */
  race<B>(other: IO<B>): IO<A | B> {
    return IO.fromThunk(() => Promise.race([this.run(), other.run()]))
  }

  /**
    Recovers from all errors with the given transformation. 
    The transformation must be pure. For an effectful transformation use recoverWith.
    */
  recover(f: (err: unknown) => A): IO<A> {
    return IO.fromThunk(() => this.thunk().catch(f))
  }

  /**
    Recovers from all errors with the given transformation.
    */
  recoverWith(f: (err: unknown) => IO<A>): IO<A> {
    return IO.fromThunk(() => this.thunk().catch(err => f(err).run()))
  }

  /**
    Retry this effect with the given retry policy.
    */
  retry(policy: RetryPolicy): IO<A> {
    return IO.fromThunk(() => IO.withRetries(this.thunk, policy))
  }

  /**
    Run this effect. 
    This method is unsafe and will force evaluation.
    */
  run(): Promise<A> {
    return this.thunk()
  }

  /**
    Schedule this effect to run periodically with the specified period.
    You can also specify how many times you will allow the effect to fail before the schedule fails.
    */
  scheduleForever(ms: number, patience = 0): IO<never> {
    if (patience < 0) {
      return IO.fail('Cannot schedule with negative patience')
    }
    return IO.sleep(ms)
      .flatMap(() => this.flatMap(_ => this.scheduleForever(ms, patience)))
      .recoverWith(error => {
        if (patience === 0) {
          return IO.fail(error)
        } else {
          return this.scheduleForever(ms, patience - 1)
        }
      })
  }

  /**
    Schedule this effect to run after the specified time.
    */
  scheduleOnce(ms: number): IO<A> {
    return IO.sleep(ms).flatMap(() => this)
  }

  /**
    Pass a callback that will be invoked when the succeess value of this effect is ready.
    */
  tap(f: (a: A) => void): IO<A> {
    return this.tapM(a => IO.fromThunkSync(() => f(a)))
  }

  /**
    Pass an effectful callback that will be unsafely run when the succeess value of this effect is ready.
    */
  tapM<B>(f: (a: A) => IO<B>): IO<A> {
    return IO.fromThunk(() =>
      this.thunk().then(res => {
        IO.safeInvoke(res, f).run()
        return res
      })
    )
  }

  /**
    Pass callbacks that will be invoked when the effect is evaluated.
    */
  tapBoth(success: (a: A) => void, failure: (err: unknown) => void): IO<A> {
    return this.tapBothM(
      a => IO.fromThunkSync(() => success(a)),
      err => IO.fromThunkSync(() => failure(err))
    )
  }

  /**
    Pass effectful callbacks that will be unsafely run when the effect is evaluated.
    */
  tapBothM<B, C>(
    success: (a: A) => IO<B>,
    failure: (err: unknown) => IO<C>
  ): IO<A> {
    return IO.fromThunk(() =>
      this.thunk()
        .then(res => {
          IO.safeInvoke(res, success).run()
          return res
        })
        .catch(err => {
          IO.safeInvoke(err, failure).run()
          return Promise.reject(err)
        })
    )
  }

  /**
    Pass a callback that will be invoked if the effect fails.
    */
  tapError(f: (error: unknown) => void): IO<A> {
    return this.tapErrorM(err => IO.fromThunkSync(() => f(err)))
  }

  /**
    Pass an effectful callback that will be unsafely run if the effect fails.
    */
  tapErrorM<B>(f: (error: unknown) => IO<B>): IO<A> {
    return IO.fromThunk(() =>
      this.thunk().catch(err => {
        IO.safeInvoke(err, f).run()
        return Promise.reject(err)
      })
    )
  }

  /**
    Transforms the result of this effect to a data structure that contains the duration
    and result of the evaluation. This happens to both the error and the success result.
    */
  timed(): IO<Timed<A>> {
    return IO.fromThunk(() => {
      const initial = Date.now()
      return this.thunk()
        .then(result => ({
          result,
          duration: Date.now() - initial
        }))
        .catch(error =>
          Promise.reject({
            result: error,
            duration: Date.now() - initial
          })
        )
    })
  }

  /**
    Create an effect that will fail if this effect does not finish in the specified time.
    Note that since Promise cannot be cancelled, the finalizers of this effect will have to run
    even if the new effect fails due to a timeout. This means that if you want to prevent an 
    unwanted side effect, you will have to attach it's finalizer to the effect created by timeout.
    */
  timeout(interval: number): IO<A> {
    return IO.fromThunk(() =>
      Promise.race([
        this.thunk(),
        new Promise<A>((_, reject) => {
          const id = setTimeout(() => {
            clearTimeout(id)
            reject(new TimeoutError(`Promise timed out in ${interval} ms.`))
          }, interval)
        })
      ])
    )
  }

  /**
    Creates an effect which is the result of sequencing this effect and the given effect.
    */
  zip<B>(right: IO<B>): IO<[A, B]> {
    return IO.fromThunk(() =>
      this.run().then(a => right.run().then(b => [a, b]))
    )
  }

  /**
    Creates an effect which is the result of sequencing this effect and the given effect and
    discarding the value produced by the latter.
    */
  zipLeft<B>(right: IO<B>): IO<A> {
    return this.flatMap(a => right.map(_ => a))
  }

  /**
    Creates an effect which is the result of running this effect and the given effect in parallel.
    */
  zipPar<B>(right: IO<B>): IO<[A, B]> {
    return IO.fromThunk(() => Promise.all([this.run(), right.run()]))
  }

  /**
    Creates an effect which is the result of running this effect and the given effect in parallel
    and discarding the value produced by the latter.
    */
  zipLeftPar<B>(right: IO<B>): IO<A> {
    return IO.fromThunk(() =>
      Promise.all([this.run(), right.run()]).then(tupled => tupled[0])
    )
  }

  /**
    Creates an effect which is the result of sequencing this effect and the given effect and
    discarding the value produced by the former.
    */
  zipRight<B>(right: IO<B>): IO<B> {
    return this.flatMap(_ => right)
  }

  /**
    Creates an effect which is the result of running this effect and the given effect in parallel
    and discarding the value produced by the former.
    */
  zipRightPar<B>(right: IO<B>): IO<B> {
    return IO.fromThunk(() =>
      Promise.all([this.run(), right.run()]).then(tupled => tupled[1])
    )
  }
}

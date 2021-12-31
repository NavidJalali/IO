import { Cause, Die, Fail } from "./models/Cause"
import { Fiber, FiberRuntime } from "./models/Fiber"
import { Stack } from "./models/Stack"
import { Tag } from "./models/Tag"

// Version 2 ideation file
abstract class IO<E, A> {
  abstract tag: Tag

  static async<A1>(register: (_: (_: A1) => any) => void): IO<never, A1> {
    return new Async(register)
  }

  static succeed<B>(value: () => B): IO<never, B> {
    return new Effect(value)
  }

  static fail<E1>(value: () => E1): IO<E1, never> {
    return new Failure(() => new Fail(value()))
  }

  private static succeedNow<B>(value: B): IO<never, B> {
    return new Succeed(value)
  }

  as<B>(that: () => B): IO<E, B> {
    return this.map(_ => that())
  }

  asPure<B>(b: B): IO<E, B> {
    return this.map(_ => b)
  }

  fork(): IO<never, Fiber<E, A>> {
    return new Fork(this)
  }

  map<B>(f: (_: A) => B): IO<E, B> {
    return this.flatMap(a => IO.succeedNow(f(a)))
  }

  repeat(n: number): IO<E, A[]> {
    if (n <= 0) {
      return IO.succeedNow([])
    } else {
      return this.flatMap(a => this.repeat(n - 1).map(as => [a, ...as]))
    }
  }

  flatMap<E1, A1>(transformation: (_: A) => IO<E1, A1>): IO<E | E1, A1> {
    return new FlatMap(this, transformation)
  }

  foldIOCause<P, Q>(
    success: (_: A) => IO<P, Q>,
    failure: (_: Cause<E>) => IO<P, Q>
  ): IO<P, Q> {
    return new FoldIOCause(success, failure)
  }

  fold<B>(success: (_: A) => B, failure: (_: E) => B): IO<never, B> {
    return this.foldIO(
      a => IO.succeed(() => success(a)),
      e => IO.succeed(() => failure(e))
    )
  }

  foldIO<P, Q>(
    success: (_: A) => IO<P, Q>,
    failure: (_: E) => IO<P, Q>
  ): IO<P, Q> {
    return this.foldIOCause(success, cause => {
      if (cause.tag.typeTag == 'Fail') {
        return failure((cause as Fail<E>).error)
      } else {
        return new Failure(() => cause as Die as Cause<P>)
      }
    })
  }

  zip<E1, A1>(that: IO<E1, A1>): IO<E | E1, [A, A1]> {
    return this.flatMap(a => that.flatMap(b => IO.succeedNow([a, b])))
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

  unsafeRunCause(success: (_: A) => any, failure: (_: Cause<E>) => any) {
    unsafeRunCause(this)(success, failure)
  }
}

class FoldIOCause<E, A, P, Q> extends IO<P, Q> {
  constructor(
    onSuccess: (_: A) => IO<P, Q>,
    onFailure: (_: Cause<E>) => IO<P, Q>
  ) {
    super()
    this.onSuccess = onSuccess
    this.onFailure = onFailure
  }

  tag: Tag = {
    typeTag: 'FoldIOCause'
  }

  onSuccess: (_: A) => IO<P, Q>
  onFailure: (_: Cause<E>) => IO<P, Q>
}

class Async<A> extends IO<never, A> {
  constructor(register: (_: (_: A) => any) => void) {
    super()
    this.register = register
  }

  register: (_: (_: A) => any) => void

  tag: Tag = {
    typeTag: 'Async'
  }
}

class Fork<E, A> extends IO<never, Fiber<E, A>> {
  constructor(effect: IO<E, A>) {
    super()
    this.effect = effect
  }

  effect: IO<E, A>

  tag: Tag = {
    typeTag: 'Fork'
  }
}

class Failure<E> extends IO<E, never> {
  constructor(cause: () => Cause<E>) {
    super()
    this.cause = cause
  }

  cause: () => Cause<E>

  tag: Tag = {
    typeTag: 'Failure'
  }
}

class Succeed<A> extends IO<never, A> {
  constructor(a: A) {
    super()
    this.value = a
  }

  value: A

  tag: Tag = {
    typeTag: 'Succeed'
  }
}

class Effect<A> extends IO<never, A> {
  constructor(a: () => A) {
    super()
    this.thunk = a
  }

  thunk: () => A

  tag: Tag = {
    typeTag: 'Effect'
  }
}

class FlatMap<E0, E1, A0, A1> extends IO<E0 | E1, A1> {
  constructor(effect: IO<E0, A0>, continuation: (_: A0) => IO<E1, A1>) {
    super()
    this.effect = effect
    this.continuation = continuation
  }

  effect: IO<E0, A0>
  continuation: (_: A0) => IO<E1, A1>

  tag: Tag = {
    typeTag: 'FlatMap'
  }
}

function unsafeRunCause<E, A>(
  io: IO<E, A>
): (_: (_: A) => any, __: (_: Cause<E>) => any) => void {
  return (success, failure) => {
    type Erased = IO<any, any>
    type Continuation = (_: any) => Erased

    const erased = <M, N>(typed: IO<M, N>): Erased => typed

    const stack = new Stack<Continuation>()
    let currentIO = erased(io)
    let loop = true

    const complete = (value: any) => {
      if (stack.isEmpty()) {
        loop = false
        success(value as A)
      } else {
        const cont = stack.pop()!
        currentIO = cont(value)
      }
    }

    const resume = () => {
      loop = true
      run()
    }

    const run = () => {
      while (loop) {
        switch (currentIO.tag.typeTag) {
          case 'Succeed': {
            complete((currentIO as Succeed<any>).value)
            break
          }

          case 'Effect': {
            try {
              const result = (currentIO as Effect<any>).thunk()
              complete(result)
            } catch (error) {
              failure(new Die(error))
              loop = false
            }
            break
          }

          case 'FlatMap': {
            const asFlatMap = currentIO as FlatMap<any, any, any, any>
            stack.push(asFlatMap.continuation)
            currentIO = asFlatMap.effect
            break
          }

          case 'Failure': {
            //const asFailure = currentIO as Failure<any>
            throw 'Not implemented'
            // TODO: What do?
            break
          }

          case 'Async': {
            const async = currentIO as Async<any>
            loop = false
            if (stack.isEmpty()) {
              async.register(success)
            } else {
              async.register(a => {
                currentIO = new Succeed(a)
                resume()
              })
            }
            break
          }

          case 'Fork': {
            const fork = currentIO as Fork<any, any>
            const fiber = new FiberRuntime(fork.effect)
            complete(fiber)
            break
          }

          default: {
            throw Error('Unknown IO type')
          }
        }
      }
    }

    run()
  }
}

export {
  IO,
  Fiber
}
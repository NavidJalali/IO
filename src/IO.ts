// Version 2 ideation file
abstract class IO<E, A> {
  abstract tag: Tag

  static async<E1, A1>(
    register: (_: (_: IO<E1, A1>) => any) => void
  ): IO<E1, A1> {
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

  flatMap<B>(transformation: (_: A) => IO<E, B>): IO<E, B> {
    return new FlatMap(this, transformation)
  }

  zip<B>(that: IO<E, B>): IO<E, [A, B]> {
    return this.flatMap(a => that.flatMap(b => IO.succeedNow([a, b])))
  }

  zipRight<B>(that: IO<E, B>): IO<E, B> {
    return this.zipWith(that)(t => t[1])
  }

  zipLeft<B>(that: IO<E, B>): IO<E, A> {
    return this.zipWith(that)(t => t[0])
  }

  zipWith<B>(that: IO<E, B>): <C>(_: (_: [A, B]) => C) => IO<E, C> {
    return f => this.flatMap(a => that.map(b => f([a, b])))
  }
}

type Callback<A> = (_: A) => any

type FiberState<E, A> =
  | {
      success: A
      failure: null
      state: 'success'
    }
  | {
      success: null
      failure: E
      state: 'failed'
    }
  | { success: null; failure: null; state: 'pending' }

interface Fiber<E, A> {
  join(): IO<E, A>
  interrupt(): IO<E, A>
}

class FiberRuntime<E, A> implements Fiber<E, A> {
  constructor(effect: IO<E, A>) {
    // gotta run the effect without blocking, and get back the result
    // maybe web workers?
    // call all callbacks with the result
  }

  interrupt(): IO<E, A> {
    throw new Error('Method not implemented.')
  }

  fiberState: FiberState<E, A> = {
    success: null,
    failure: null,
    state: 'pending'
  }

  callbacks: Callback<IO<E, A>>[] = []

  join(): IO<E, A> {
    switch (this.fiberState.state) {
      case 'success': {
        return new Succeed(this.fiberState.success)
      }
      case 'failed': {
        return IO.fail(() => this.fiberState.failure)
      }
      case 'pending': {
        return IO.async(complete => {
          this.callbacks.push(complete)
        })
      }
    }
  }
}

class Async<E, A> extends IO<E, A> {
  constructor(register: (_: (_: IO<E, A>) => any) => void) {
    super()
    this.register = register
  }

  register: (_: (_: IO<E, A>) => any) => void

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

class FlatMap<E, A, B> extends IO<E, B> {
  constructor(effect: IO<E, A>, continuation: (_: A) => IO<E, B>) {
    super()
    this.effect = effect
    this.continuation = continuation
  }

  effect: IO<E, A>
  continuation: (_: A) => IO<E, B>

  tag: Tag = {
    typeTag: 'FlatMap'
  }
}

function unsafeRunCause<E, A>(
  io: IO<E, A>
): (onSuccess: (_: A) => void, onFailure: (_: Cause<E>) => void) => void {
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
          const asFlatMap = currentIO as FlatMap<any, any, any>
          stack.push(asFlatMap.continuation)
          currentIO = asFlatMap.effect
          break
        }

        case 'Failure': {
          
        }

        //... match on all IO types here

        default: {
          throw Error('Unknown IO type')
        }
      }
    }
  }
}

const t = IO.succeed(() => {
  console.log(3)
})

// Version 2 ideation file

interface Tag {
  typeTag: string
}

abstract class Cause<E> {
  abstract tag: Tag
}

class Die extends Cause<never> {
  constructor(error: unknown) {
    super()
    this.error = error
  }

  tag: Tag = {
    typeTag: 'Die'
  }

  error: unknown
}

class Fail<E> extends Cause<E> {
  constructor(error: E) {
    super()
    this.error = error
  }

  tag: Tag = {
    typeTag: 'Fail'
  }

  error: E
}

abstract class IO<E, A> {
  abstract tag: Tag

  static async<E1, A1>(register: (_: (_: IO<E1, A1>) => any) => void): IO<E1, A1> {
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

  flatMap<B>(transformation: (_: A) => IO<E, B>): IO<E, B> {
    return new FlatMap(this, transformation)
  }

  zip<B>(that: IO<E, B>): IO<E, [A, B]> {
    return this.flatMap(a => that.flatMap(b => IO.succeedNow([a, b])))
  }
}

type Callback<A> = (_: A) => any    

type FiberState<E, A> = { 
  success: A, 
  failure: null,
   state: 'success'
  } | { 
    success: null,
     failure: E,
      state: 'failed'
    } | { success: null,
       failure: null,
        state: 'pending'
      } 

class Fiber<E, A> {

  constructor(effect: IO<E, A>) {
    // gotta run async
    // maybe web workers?
    // call all callbacks
  }

  fiberState: FiberState<E, A> = {
    success: null,
    failure: null,
    state: 'pending'
  }

  callbacks: Callback<IO<E, A>>[] = []

  join(): IO<E, A> {
    switch(this.fiberState.state) {
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
  constructor(effect: IO<E, A>, transformation: (_: A) => IO<E, B>) {
    super()
    this.effect = effect
    this.transformation = transformation
  }

  effect: IO<E, A>
  transformation: (_: A) => IO<E, B>

  tag: Tag = {
    typeTag: 'FlatMap'
  }
}


// Its probably better to make it into a promise E | A or even better some boxed union type
const unsafeRunToPromise = <E, A>(io: IO<E, A>): Promise<A> => {
  switch (io.tag.typeTag) {
    case 'Succeed': {
      return Promise.resolve((io as Succeed<A>).value)
    }

    case 'Effect': {
      return new Promise<A>((resolve, reject) => {
        try {
          const result = (io as Effect<A>).thunk()
          resolve(result)
        } catch (error) {
          reject(new Die(error))
        }
      })
    }

    //... match on all IO types here

    default: {
      throw Error('Unknown IO type')
    }
  }
}

const t = IO.succeed(() => {
  console.log(3)
})

unsafeRunToPromise(t).then(console.log).catch(console.error)

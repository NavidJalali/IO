type Callback<A> = (_: A) => any

type FiberState<E, A> =
  | { success: A; state: 'success' }
  | { failure: E; state: 'failed' }
  | { state: 'pending'; callbacks: Callback<A>[] }

interface Fiber<E, A> {
  join(): IO<E, A>
  interrupt(): IO<never, A>
}

class FiberRuntime<E, A> implements Fiber<E, A> {
  constructor(effect: IO<E, A>) {
    // gotta run the effect without blocking, and get back the result
    // maybe web workers?
    // call all callbacks with the result
  }

  interrupt(): IO<never, A> {
    throw new Error('Method not implemented.')
  }

  fiberState: FiberState<E, A> = {
    state: 'pending',
    callbacks: []
  }

  join(): IO<E, A> {
    switch (this.fiberState.state) {
      case 'success': {
        return new Succeed(this.fiberState.success)
      }

      case 'failed': {
        const failure = this.fiberState.failure
        return IO.fail(() => failure)
      }

      case 'pending': {

        return IO.async(complete => {
          this.fiberState.push(complete)
        })
      }
    }
  }
}

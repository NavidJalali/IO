import { IO } from "../IO"
import { Nil, List, Cons } from "./List"

type Callback<A> = (_: A) => any

type FiberState<E, A> =
  | { success: A; state: 'success' }
  | { failure: E; state: 'failed' }
  | { state: 'pending'; callbacks: List<Callback<A>> }

export interface Fiber<E, A> {
  join(): IO<E, A>
  interrupt(): IO<never, A>
}

export class FiberRuntime<E, A> implements Fiber<E, A> {
  constructor(effect: IO<E, A>) {
    new Promise((resolve, reject) => {
      effect.unsafeRunCause(a => {  
        this.complete(a)
        resolve(a)
      }, reject)
    })
  }

  private fiberState: FiberState<E, A> = {
    state: 'pending',
    callbacks: new Nil()
  }

  private complete(result: A) {
    switch (this.fiberState.state) {
      case 'success': {
        throw 'Internal defect: Fiber cannot be completed multiple times.'
      }

      case 'failed': {
        throw 'Internal defect: Fiber cannot be completed multiple times.'
      }

      case 'pending': {
        this.fiberState.callbacks.foreach(callback => callback(result))
        this.fiberState = {
          state: 'success',
          success: result
        }
      }
    }
  }

  private await(callback: (_: A) => any) {    
    switch (this.fiberState.state) {
      case 'success': {
        callback(this.fiberState.success)
        break
      }

      case 'failed': {
        throw 'fuck'
        // TODO: What do?
      }

      case 'pending': {
        this.fiberState.callbacks = new Cons(
          callback,
          this.fiberState.callbacks
        )   
        break     
      }
    }
  }

  interrupt(): IO<never, A> {
    throw new Error('Method not implemented.')
  }

  join(): IO<E, A> {
    return IO.async(callback => this.await(callback))
  }
}

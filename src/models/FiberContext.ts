import {
  Async,
  SucceedNow,
  FlatMap,
  Fold,
  Fork,
  IO,
  Succeed,
  Failure
} from '../IO'
import { Cause, Die } from './Cause'
import { Fiber, FiberResult } from './Fiber'
import { Cons, List, Nil } from './List'
import { Stack } from './Stack'

type Callback<E, A> = (_: FiberResult<E, A>) => any

type FiberState<E, A> =
  | { success: A; state: 'success' }
  | { failure: Cause<E>; state: 'failed' }
  | { state: 'pending'; callbacks: List<Callback<E, A>> }

const fiberSucceed = <A>(a: A): FiberResult<never, A> => ({
  success: a,
  isSuccess: true
})

const fiberFail = <E>(cause: Cause<E>): FiberResult<E, never> => ({
  failure: cause,
  isSuccess: false
})

type Erased = IO<any, any>

class Continuation {
  constructor(cont: (_: any) => Erased) {
    this.continue = cont
  }

  static fromFold(fold: Fold<any, any, any, any>): Continuation {
    const cont = new Continuation(fold.onSuccess)
    cont.errorHandler = fold.onFailure
    return cont
  }

  errorHandler: ((_: Cause<any>) => Erased) | null = null
  continue: (_: any) => Erased
}

export class FiberContext<E, A> implements Fiber<E, A> {
  constructor(io: IO<E, A>) {
    const erased = <M, N>(typed: IO<M, N>): Erased => typed

    const stack = new Stack<Continuation>()
    let currentIO = erased(io)
    let loop = true

    const continueLoop = (value: any) => {
      if (stack.isEmpty()) {
        loop = false
        this.complete(fiberSucceed(value as A))
      } else {
        const cont = stack.pop()!
        currentIO = cont.continue(value)
      }
    }

    const findNextErrorHandler = (): Continuation | null => {
      let looping = true
      let errorHandler = null
      while (looping) {
        if (stack.isEmpty()) {
          looping = false
        } else {
          const continuation = stack.pop()!
          if (continuation.errorHandler !== null) {
            looping = false
            errorHandler = continuation
          }
        }
      }
      return errorHandler
    }

    const resume = () => {
      loop = true
      run()
    }

    const run = () => {
      while (loop) {
        switch (currentIO.tag) {
          case 'SucceedNow': {
            continueLoop((currentIO as SucceedNow<any>).value)
            break
          }

          case 'Succeed': {
            try {
              const result = (currentIO as Succeed<any>).thunk()
              continueLoop(result)
            } catch (error) {
              this.complete({ failure: new Die(error), isSuccess: false })
              loop = false
            }
            break
          }

          case 'FlatMap': {
            const asFlatMap = currentIO as FlatMap<any, any, any, any>
            stack.push(new Continuation(asFlatMap.continuation))
            currentIO = asFlatMap.effect
            break
          }

          case 'Failure': {
            const asFailure = currentIO as Failure<any>
            const errorHandler = findNextErrorHandler()
            if (errorHandler === null || errorHandler.errorHandler === null) {
              this.complete(fiberFail(asFailure.cause() as Cause<E>))
              loop = false
            } else {
              currentIO = errorHandler.errorHandler(asFailure.cause())
            }
            break
          }

          case 'Fold': {
            const asFold = currentIO as Fold<any, any, any, any>
            currentIO = asFold.io
            stack.push(Continuation.fromFold(asFold))
            break
          }

          case 'Async': {
            const async = currentIO as Async<any>
            loop = false
            if (stack.isEmpty()) {
              async.register(a => this.complete(fiberSucceed(a as A)))
            } else {
              async.register(a => {
                currentIO = new SucceedNow(a)
                resume()
              })
            }
            break
          }

          case 'Fork': {
            const fork = currentIO as Fork<any, any>
            const fiber = new FiberContext(fork.effect)
            continueLoop(fiber)
            break
          }

          default: {
            throw Error('Unknown IO type')
          }
        }
      }
    }

    this.executor = new Promise<FiberResult<E, A>>(resolve => {
      run()
      this.await(resolve)
    })
  }

  private fiberState: FiberState<E, A> = {
    state: 'pending',
    callbacks: new Nil()
  }

  private complete(result: FiberResult<E, A>) {
    switch (this.fiberState.state) {
      case 'success': {
        throw `Internal defect: Fiber cannot be completed multiple times. 
        Fiber state was ${JSON.stringify(
          this.fiberState
        )}. Attempted to complete with ${JSON.stringify(result)}`
      }

      case 'failed': {
        throw `Internal defect: Fiber cannot be completed multiple times. 
        Fiber state was ${JSON.stringify(
          this.fiberState
        )}. Attempted to complete with ${JSON.stringify(result)}`
      }

      case 'pending': {
        this.fiberState.callbacks.foreach(callback => callback(result))
        if (result.isSuccess) {
          this.fiberState = {
            state: 'success',
            success: result.success
          }
        } else {
          this.fiberState = {
            state: 'failed',
            failure: result.failure
          }
        }
      }
    }
  }

  private await(callback: (_: FiberResult<E, A>) => any) {
    switch (this.fiberState.state) {
      case 'success': {
        callback({
          success: this.fiberState.success,
          isSuccess: true
        })
        break
      }

      case 'failed': {
        callback({
          failure: this.fiberState.failure,
          isSuccess: false
        })
        break
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

  executor: Promise<FiberResult<E, A>>

  interrupt(): IO<never, A> {
    throw new Error('Method not implemented.')
  }

  join(): IO<E, A> {
    return IO.async<FiberResult<E, A>>(callback =>
      this.await(callback)
    ).flatMap(fiberRes => {
      if (fiberRes.isSuccess === true) {
        return new SucceedNow(fiberRes.success)
      } else {
        return new Failure(() => fiberRes.failure)
      }
    })
  }
}

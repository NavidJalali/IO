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
import { Cause } from './Cause'
import { Exit } from './Exit'
import { Fiber } from './Fiber'
import { Cons, List, Nil } from './List'
import { Stack } from './Stack'
import { Tags } from './Tag'

type Callback<E, A> = (_: Exit<E, A>) => any

type FiberState<E, A> =
  | { state: 'done'; result: Exit<E, A> }
  | { state: 'running'; callbacks: List<Callback<E, A>> }

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
        this.complete(Exit.succeed(value as A))
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
        try {
          switch (currentIO.tag) {
            case Tags.succeedNow: {
              continueLoop((currentIO as SucceedNow<any>).value)
              break
            }

            case Tags.succeed: {
              const result = (currentIO as Succeed<any>).thunk()
              continueLoop(result)
              break
            }

            case Tags.flatMap: {
              const asFlatMap = currentIO as FlatMap<any, any, any, any>
              stack.push(new Continuation(asFlatMap.continuation))
              currentIO = asFlatMap.effect
              break
            }

            case Tags.failure: {
              const cause = (currentIO as Failure<any>).cause()
              const errorHandler = findNextErrorHandler()
              if (errorHandler === null || errorHandler.errorHandler === null) {
                this.complete(Exit.failCause(cause as Cause<E>))
                loop = false
              } else {
                currentIO = errorHandler.errorHandler(cause)
              }
              break
            }

            case Tags.fold: {
              const asFold = currentIO as Fold<any, any, any, any>
              currentIO = asFold.io
              stack.push(Continuation.fromFold(asFold))
              break
            }

            case Tags.async: {
              const async = currentIO as Async<any>
              loop = false
              if (stack.isEmpty()) {
                async.register(a => this.complete(Exit.succeed(a as A)))
              } else {
                async.register(a => {
                  currentIO = new SucceedNow(a)
                  resume()
                })
              }
              break
            }

            case Tags.fork: {
              const fork = currentIO as Fork<any, any>
              const fiber = new FiberContext(fork.effect)
              continueLoop(fiber)
              break
            }
          }
        } catch (error) {
          currentIO = IO.die(error)
        }
      }
    }

    this.executor = new Promise<Exit<E, A>>(resolve => {
      run()
      this.await(resolve)
    })
  }

  private fiberState: FiberState<E, A> = {
    state: 'running',
    callbacks: new Nil()
  }

  private complete(result: Exit<E, A>) {
    switch (this.fiberState.state) {
      case 'done': {
        throw `Internal defect: Fiber cannot be completed multiple times. 
        Fiber state was ${JSON.stringify(
          this.fiberState
        )}. Attempted to complete with ${JSON.stringify(result)}`
      }

      case 'running': {
        this.fiberState.callbacks.foreach(callback => callback(result))
        this.fiberState = {
          state: 'done',
          result
        }
      }
    }
  }

  private await(callback: (_: Exit<E, A>) => any) {
    switch (this.fiberState.state) {
      case 'done': {
        callback(this.fiberState.result)
        break
      }

      case 'running': {
        this.fiberState.callbacks = new Cons(
          callback,
          this.fiberState.callbacks
        )
        break
      }
    }
  }

  executor: Promise<Exit<E, A>>

  interrupt(): IO<never, A> {
    throw new Error('Method not implemented.')
  }

  join(): IO<E, A> {
    return IO.async<Exit<E, A>>(callback => this.await(callback)).flatMap(
      IO.fromExit
    )
  }
}

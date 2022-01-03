import { IO } from '../IO'
import { Cause } from './Cause'

export type FiberResult<E, A> =
  | { success: A; isSuccess: true }
  | { failure: Cause<E>; isSuccess: false }

export interface Fiber<E, A> {
  join(): IO<E, A>
  interrupt(): IO<never, A>
  executor: Promise<FiberResult<E, A>>
}

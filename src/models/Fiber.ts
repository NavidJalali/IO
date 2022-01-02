import { IO } from '../IO'

export interface Fiber<E, A> {
  join(): IO<E, A>
  interrupt(): IO<never, A>
}

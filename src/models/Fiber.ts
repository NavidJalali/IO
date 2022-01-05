import { IO } from '../IO'
import { Exit } from './Exit'

export interface Fiber<E, A> {
  join(): IO<E, A>
  interrupt(): IO<never, A>
  executor: Promise<Exit<E, A>>
}

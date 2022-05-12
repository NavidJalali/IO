import { IO } from '../IO'
import { Exit } from './Exit'

export interface Fiber<E, A> {
  join(): IO<E, A>
  interrupt(): IO<never, void>
  executor: Promise<Exit<E, A>>
}

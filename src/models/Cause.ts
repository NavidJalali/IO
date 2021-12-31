import { Tag } from "./Tag"

export abstract class Cause<E> {
  abstract tag: Tag
  abstract error: E | null
}

export class Die extends Cause<never> {
  constructor(error: unknown) {
    super()
    this.reason = error
  }

  tag: Tag = {
    typeTag: 'Die'
  }
  
  error = null

  reason: unknown
}

export class Fail<E> extends Cause<E> {
  constructor(error: E) {
    super()
    this.error = error
  }

  tag: Tag = {
    typeTag: 'Fail'
  }

  error: E
}

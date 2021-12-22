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

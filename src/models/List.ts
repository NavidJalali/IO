export abstract class List<A> {
  static fromArray<B>(as: B[]): List<B> {
    let current: List<B> = new Nil()
    for (let i = as.length - 1; i >= 0; i--) {
      current = current.prepend(as[i]!)
    }
    return current
  }

  protected abstract lastCons: Cons<A> | null

  abstract head(): A
  abstract headOption(): A | null
  abstract tail(): List<A>
  abstract tailOption(): List<A> | null
  abstract fold<B>(ifCons: (x: A, xs: List<A>) => B, ifNil: () => B): B
  abstract foreach(_: (_: A) => any): void
  abstract map<B>(f: (_: A) => B): List<B>
  abstract flatMap<B>(f: (_: A) => List<B>): List<B>
  abstract length: number

  last(): A {
    if (this.lastCons) {
      return this.lastCons.head()
    } else {
      throw 'Last of empty Lists'
    }
  }

  lastOption(): A | null {
    return this.lastCons ? this.lastCons.head() : null
  }

  toArray(): A[] {
    const arr: A[] = []
    this.foreach(a => arr.push(a))
    return arr
  }

  isEmpty(): boolean {
    return this.fold(
      _ => false,
      () => true
    )
  }

  nonEmpty(): boolean {
    return !this.isEmpty()
  }

  hasNext(): Boolean {
    return !this.isEmpty()
  }

  prepend(a: A): List<A> {
    return new Cons(a, this)
  }
}

export class Cons<A> extends List<A> {
  constructor(a: A, as: List<A>) {
    super()
    this.a = a
    this.as = as
    this.length = as.length + 1

    if (as.isEmpty()) {
      this.lastCons = this
    } else {
      this.lastCons = (as as Cons<A>).lastCons
    }
  }

  protected a: A
  protected as: List<A>
  protected lastCons: Cons<A>

  length: number

  foreach(callback: (_: A) => any): void {
    let current: List<A> = this

    while (!current.isEmpty()) {
      callback(current.head())
      current = current.tail()
    }
  }

  head(): A {
    return this.a
  }

  headOption(): A | null {
    return this.a
  }

  tail(): List<A> {
    return this.as
  }

  map<B>(f: (_: A) => B): List<B> {
    const nil = new Nil()
    let current: List<A> = this.as
    const head = new Cons(f(this.a), nil)

    while (current.hasNext()) {
      const newLast = new Cons(f(current.head()), nil)
      head.lastCons.as = newLast
      head.lastCons = newLast
      current = current.tail()
    }

    return head
  }

  flatMap<B>(f: (_: A) => List<B>): List<B> {
    let current = this.as
    let head = f(this.a)

    while (current.hasNext()) {
      const newList = f(current.head())

      if (head.isEmpty()) {
        head = newList
      } else {
        if (newList.nonEmpty()) {
          ;(head as Cons<B>).lastCons.as = newList
          ;(head as Cons<B>).lastCons = (newList as Cons<B>).lastCons
        }
      }

      current = current.tail()
    }

    return head
  }

  tailOption(): List<A> | null {
    return this.as
  }

  fold<B>(ifCons: (x: A, xs: List<A>) => B, _: () => B): B {
    return ifCons(this.a, this.as)
  }
}

export class Nil extends List<never> {
  lastCons = null

  length: number = 0

  foreach(_: (_: never) => any): void {
    return
  }

  head(): never {
    throw new Error('Head of empty List')
  }

  headOption(): null {
    return null
  }

  tail(): List<never> {
    throw new Error('Tail of empty List')
  }

  tailOption(): List<never> | null {
    return null
  }

  map<B>(_: (_: never) => B): List<B> {
    return this
  }

  flatMap<B>(_: (_: never) => List<B>): List<B> {
    return this
  }

  fold<B>(_: (x: never, xs: List<never>) => B, ifNil: () => B): B {
    return ifNil()
  }
}

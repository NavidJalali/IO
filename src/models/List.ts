export abstract class List<A> {
  static fromArray<B>(as: B[]): List<B> {
    return List.of(as, as.length - 1)
  }

  private static of<B>(as: B[], start: number): List<B> {
    if (start < 0 || start >= as.length) {
      throw new Error('Index out of bounds.')
    }

    if (start == 0) {
      return new Nil()
    } else {
      const a = as[start]
      if (a) {
        return new Cons(a, List.of(as, start - 1))
      } else {
        return List.of(as, start - 1)
      }
    }
  }

  abstract head(): A
  abstract headOption(): A | null
  abstract tail(): List<A>
  abstract tailOption(): List<A> | null
  abstract isEmpty(): boolean
  abstract fold<B>(ifCons: (x: A, xs: List<A>) => B, ifNil: () => B): B
  abstract foreach(_: (_: A) => any): void
  prepend(a: A): List<A> {
    return new Cons(a, this)
  }
}

export class Cons<A> extends List<A> {
  constructor(a: A, as: List<A>) {
    super()
    this.a = a
    this.as = as
  }

  private a: A
  private as: List<A>

  foreach(callback: (_: A) => any): void {
    callback(this.a)
    this.as.foreach(callback)
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

  tailOption(): List<A> | null {
    return this.as
  }

  isEmpty(): boolean {
    return false
  }

  fold<B>(ifCons: (x: A, xs: List<A>) => B, _: () => B): B {
    return ifCons(this.a, this.as)
  }
}

export class Nil extends List<never> {
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

  isEmpty(): boolean {
    return true
  }

  fold<B>(_: (x: never, xs: List<never>) => B, ifNil: () => B): B {
    return ifNil()
  }
}

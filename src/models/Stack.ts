import { List, Nil } from "./List"

export class Stack<A> {
  private list: List<A> = new Nil()

  push(a: A): void {
    this.list = this.list.prepend(a)
  }

  pop(): A | null {
    const headOption = this.list.headOption()
    if (headOption) {
      this.list = this.list.tail()
      return headOption
    } else {
      return null
    }
  }

  peek(): A | null {
    return this.list.headOption()
  }

  isEmpty(): boolean {
    return this.list.isEmpty()
  }
}

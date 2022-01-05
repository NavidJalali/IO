import { List } from './models/List'

const l = List.fromArray([1, 2, 3, 4])

console.log(l.toArray())
//l.flatMap(_ => List.fromArray([1, 2]))
console.log(l.flatMap(_ => List.fromArray([1, 2].map(i => i * _))).toArray())

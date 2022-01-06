import { IO } from './IO'

// const t = IO.succeed(() => 1)
//   .forever()
//   .fork()
//   .flatMap(f => {
//     console.log(f);
//     return f.interrupt()
//   })

const t = IO.sleep(10000).fork().flatMap(_ => {
  console.log(_)
  return IO.sleep(2000).tap(_ => console.log("interrupting now!")).flatMap(__ => _.interrupt())
})

t.unsafeRun()

import { IO } from './IO'

// const t = IO.succeed(() => 1)
//   .forever()
//   .fork()
//   .flatMap(f => {
//     console.log(f);
//     return f.interrupt()
//   })

const t = IO.succeed(() => 1000000*9999999).repeat(999999999).fork().flatMap(_ => _.interrupt())

t.unsafeRun()

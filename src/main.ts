import { IO } from './IO'

const t = IO.succeed(() => console.log('HOWDY'))
  .forever()
  .fork()
  .flatMap(f => IO.sleep(2000).zipRight(f.interrupt()))

t.unsafeRun()

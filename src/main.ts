import { IO } from './IO'

IO.sleep(5000).flatMap(_ => IO.printLine("one")).timeout(300)
  .unsafeRun()
  .then(console.log)

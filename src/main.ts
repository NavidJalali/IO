import { IO } from './IO'

IO.fromPromise(() => Promise.reject(1))
  .mapError(_ => _ as number)
  .unsafeRun()
  .then(console.log)

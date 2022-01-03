import { IO } from './IO'

const t = new Date().getTime()
IO.fromPromise(
  () =>
    new Promise(resolve => {
      setTimeout(() => resolve(1), 3000)
    })
)
  // IO.sleep(3000)
  .tap(res => console.log(res, new Date().getTime() - t))
  .unsafeRun()

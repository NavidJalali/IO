import { IO } from './IO'

IO.sleep(100)
  .zipRight(
    IO.succeed(() => {
      throw 'Dick'
    })
  )
  .foldIOCause(
    _ => {
      console.log('here')
      return IO.fail(() => 1)
    },
    i => IO.succeed(() => i)
  )
  .unsafeRun()
  .then(console.log)

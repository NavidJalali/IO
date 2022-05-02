import { IO } from './IO'

IO.unit()
  .unsafeRun()
  .then(console.log)
  .catch(e => console.log(`ERROR ${e}`))

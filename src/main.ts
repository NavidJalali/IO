import { IO } from './IO'

const t = IO.fail(() => 0)

t.unsafeRun().then(console.log).catch(e => console.error(`err: ${e}`))

// Fold, Fold, Failure


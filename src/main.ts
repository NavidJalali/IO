import { IO } from './IO'

IO.succeed(() => console.log("hi!")).forever().unsafeRun()
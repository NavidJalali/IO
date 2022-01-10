import { IO } from './IO'

IO.succeed(() => console.log("Hi"))
  .forever()
  .fork()
  .flatMap(fiber => IO.sleep(1000).zipRight(fiber.interrupt()).zipRight(IO.succeed(() => console.log("HIIII"))))
  .unsafeRun()

setTimeout(() => {
    console.log("I can get scheduled")
}, 0)


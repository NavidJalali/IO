import { IO } from './IO'

IO.succeed(() => 1)
  .forever()
  .fork()
  // .flatMap(fiber => IO.sleep(1).zipRight(fiber.interrupt()).zipRight(IO.succeed(() => console.log("HIIII"))))
  .unsafeRun()


setTimeout(() => {
    console.log("I can get scheduled")
}, 10)


import { IO } from './IO'

// IO.succeed(() => 1)
//   .forever()
//   .fork()
//   .flatMap(fiber => IO.sleep(1).zipRight(fiber.interrupt()).zipRight(IO.succeed(() => console.log("HIIII"))))
//   .unsafeRun()

Promise.resolve()
  .then(_ => {
    for (let i = 0; i < 999999999; i++) {
      124151254 * 23423  * i
    }
  })
  .then(_ => console.log("butt"))


setTimeout(() => {
    console.log("I can get scheduled")
}, 0)


import { IO } from './IO'


const t = (time: number) => new Promise<string>(resolve => {
    setTimeout(() => resolve("Hello"), time)
})

const t1 = new Date().getTime()
IO.fromPromise(() => t(3000)).zipPar(IO.fromPromise(() => t(500))).unsafeRun().then(_ => console.log(_, new Date().getTime() - t1))

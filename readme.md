# 🍉 IO
### A small library that makes promises less eager 🥔

`IO<A>` is a lightweight wrapper around `() => Promise<A>` with some useful combinators.

## 🔧 Installation

`npm install @navidjalali/io`

## ⚡️ How to make an IO

You can make a new IO using one of the following ways:

##### 🏋🏻‍♂️ Lifting a pure value into an IO:

You can make a successful or failed lazy promise out of a pure value.

```typescript
IO.succeed(value)
```
```typescript
IO.fail(error)
```
```typescript
IO.fromNull(maybeNull)
```
```typescript
IO.fromUndefined(maybeUndefined)
```

##### 👷🏻‍♂️ Using the constructor:
This is very similar to creating a normal Promise.

```typescript
new IO<A>((resolve, reject) => {
    // ...
})
```

##### 🦆 From a thunk that returns a promise

Any promise can be wrapped into an IO.

```typescript
IO.fromThunk(() => fetch('/api/v1/posts'))
```

##### 🍩 From a function

Exceptions thrown by the function will be lifted into failures.

```typescript
const unsafeFunction = () => {
    // Unsafe code
}

IO.fromThunkSync(unsafeFunction))
```

## 🤔 How to evaluate an IO?

Simply call `.run()`. This will create a normal Promise.

## ❓ Polling

Any IO that will return some Union type  `A | InProgress` can be polled using `IO.poll`. This will rerun the IO until it succeeds with a result of type `A`.

## ⏰ Scheduling
You can schedule a lazy promise to run later using the `scheduleOnce` and `scheduleForever` combinators. You can also make more complicated scheduling logic yourself using `IO.sleep` and recursion.

## 🔁 Retries

You can retry an IO using a RetryPolicy. Currently you can only pick between `Spaced` and `ExponentialWithBackoff`

```typescript
IO.fromThunk(() => fetch('/api/v1/posts'))
    .retry(RetryPolicies.spaced(100, 3))
```

## ⏳ Timeout

You can effectively get a rejection if your effect runs longer than a specified period using the `timeout` combinator but please keep in mind that this *WILL NOT* cancel the Promise created from running this effect or interrupt its finalizers. Hopefully I will make this behaviour better soon.

## 🌈 More!
There's more you can do. Feel free to check the code, and contribute if you find a new usecase that can be covered!

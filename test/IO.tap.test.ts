import { IO } from '../src';

test("tap calls the callback", async () => {
    const mockCallback = jest.fn();

    const result = IO.succeed(1)
        .tap(mockCallback)
        .run();

    await expect(result).resolves.toEqual(1);
    await expect(mockCallback.mock.calls.length).toEqual(1);
});

test("multiple taps, single callback", async () => {
    const mockCallback = jest.fn();

    const result = IO.succeed(1)
        .tap(mockCallback)
        .tap(mockCallback)
        .tap(mockCallback)
        .run();

    await expect(result).resolves.toEqual(1);
    await expect(mockCallback.mock.calls.length).toEqual(3);
});

test("multiple taps, multiple callbacks", async () => {
    const mockFirstCallback = jest.fn();
    const mockSecondCallback = jest.fn();

    const result = IO.succeed(1)
        .tap(mockFirstCallback)
        .tap(mockSecondCallback)
        .tap(mockSecondCallback)
        .run();

    await expect(result).resolves.toEqual(1);
    await expect(mockFirstCallback.mock.calls.length).toEqual(1);
    await expect(mockSecondCallback.mock.calls.length).toEqual(2);
});

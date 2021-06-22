import { IO } from '../src';

test("lifting pure value works", async () => {
    await expect(IO.fromUndefined(true).run()).resolves.toEqual(true);
});

test("lifting null works", async () => {
    await expect(IO.fromUndefined(null).run()).resolves.toEqual(null);
});

test("lifting null fails", async () => {
    await expect(IO.fromUndefined(undefined).run()).rejects.toEqual("Undefined encountered");
});

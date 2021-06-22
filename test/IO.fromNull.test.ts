import { IO } from '../src';

test("lifting pure value works", async () => {
    await expect(IO.fromNull(true).run()).resolves.toEqual(true);
});

test("lifting undefined works", async () => {
    await expect(IO.fromNull(undefined).run()).resolves.toEqual(undefined);
});

test("lifting null fails", async () => {
    await expect(IO.fromNull(null).run()).rejects.toEqual("Null encountered");
});

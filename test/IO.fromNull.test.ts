import { IO } from '../src';

test("lifting pure value works", () => {
    expect(IO.fromNull(true).run()).resolves.toEqual(true);
});

test("lifting undefined works", () => {
    expect(IO.fromNull(undefined).run()).resolves.toEqual(undefined);
});

test("lifting null fails", () => {
    expect(IO.fromNull(null).run()).rejects.toEqual("Null encountered");
});

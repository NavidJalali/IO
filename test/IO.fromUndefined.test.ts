import { IO } from '../src';

test("lifting pure value works", () => {
    expect(IO.fromUndefined(true).run()).resolves.toEqual(true);
});

test("lifting null works", () => {
    expect(IO.fromUndefined(null).run()).resolves.toEqual(null);
});

test("lifting null fails", () => {
    expect(IO.fromUndefined(undefined).run()).rejects.toEqual("Undefined encountered");
});

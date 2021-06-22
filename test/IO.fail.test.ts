import { IO } from '../src';

test("fail rejects in the end", () => {
    expect(IO.fail("this is an error").run()).rejects.toEqual("this is an error");
});

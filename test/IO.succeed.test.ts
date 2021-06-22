import { IO } from '../src';

test("succeed resolves in the end", async () => {
    await expect(IO.succeed("this is a success").run()).resolves.toEqual("this is a success");
});

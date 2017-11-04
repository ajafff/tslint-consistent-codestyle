## no-unnecessary-type-annotation *(exprerimental)*

Finds type annotations of variables and parameters that can be removed because the compiler can infer the type.

**Failing:**

```ts
const foo: 1 = 1;
const foo: number = 1;
let foo: number = 1;
const arr: string[] = ["foo", "bar"];

declare function takeCallback(cb: (a: string) => void): void;
takeCallback((a: string) => a);
```

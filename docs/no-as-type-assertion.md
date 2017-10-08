## no-as-type-assertion

The complete opposite of the tslint core rule `no-angle-bracket-type-assertion` plus the ability to automatically fix all findings.

This can not be applied to `.tsx` and `.jsx` files because the `<T>` syntax is handled as JSX opening element.

```ts
// Not passing
let foo = bar as number;
let baz = bar as any as string;

// Passing
let foo = <number>bar;
let baz = <string><any>bar;
```

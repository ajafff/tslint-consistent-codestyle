## no-as-type-assertion
The complete opposite of the tslint core rule `no-angle-bracket-type-assertion` plus the ability to automatically fix all findings.

```ts
// Not passing
let foo = bar as number;
let baz = bar as any as string;

// Passing
let foo = <number>bar;
let baz = <string><any>bar;
```

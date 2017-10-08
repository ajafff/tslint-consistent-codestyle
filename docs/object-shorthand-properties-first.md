## object-shorthand-properties-first

By convention and for better readability, shorthand properties should precede regular property declarations.

Not passing:

```ts
let obj = {
  foo: foo,
  bar,
  baz: baz,
};
```

Passing:

```ts
let obj = {
  bar,
  foo: foo,
  baz: baz,
};
```

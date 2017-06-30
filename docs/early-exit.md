## early-exit

Recommends to use an early exit instead of a long `if` block.
This means to `return` early from a function, `continue` early in loop, or `break` early in a switch case.

So instead of:

```ts
function f() {
  if (so) {
    lots;
    of;
    code;
  }
}
```

Prefer:
```ts
function f() {
  if (!so) return;
  lots;
  of;
  code;
}
```

This rule also warns for if-else blocks where one branch is large and the other is a single line.
So instead of:

```ts
for (const x of xs) {
  if (so) {
    simple;
  } else {
    lots;
    of;
    code;
  }
}
```

Prefer:

```ts
for (const x of xs) {
  if (so) {
    simple;
    continue;
  }

  lots;
  of;
  code;
}
```

An options object as in `"early-exit": [true, { "max-length": 4 }}` may be provided to configure what makes a block count as "large". The default is 2 lines.

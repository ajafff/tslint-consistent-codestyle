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

An options object as in `"early-exit": [true, { "max-length": 4, "ignore-constructor": true }]` may be provided.

`"max-length"` configures what makes a block count as "large". The default is 2 lines.

If you set `"max-length"` to `0`, the rule will always suggest an early return, regardless of the line count. For example:

```ts
// instead of
function f() {
  if (so) {
    singleLine();
  }
}
// prefer
function f() {
  if (!so) return;
  singleLine();
}

// and instead of
for (const x of xs) {
  if (so) {
    foo();
  } else {
    bar();
  }
}
// prefer
for (const x of xs) {
  if (so) {
    foo();
    continue;
  }
  bar();
}
```

In addition you can choose to ignore `if` statements within class constructors with `"ignore-constructor": true` which defaults to `false`.
Enabling this option prevents potential mistakes by overriding the constructed object with a non-primitive return value.

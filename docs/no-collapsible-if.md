## no-collapsible-if

Identifies nested if statements that can be combined into one.

Also use [`no-unnecessary-else`](./no-unnecessary-else.md) to further reduce block nesting.

Not passing:

```ts
/* 1 */
if (foo)
  if (bar);
/* 2 */
if (foo) {
  if (bar) {
  }
}
/* 3 */
if (foo) {
} else {
  if (bar) {
  } else {
  }
}
```

Passing:

```ts
/* 1 */
if (foo && bar);
/* 2 */
if (foo && bar) {
}
/* 3 */
if (foo) {
} else if (bar) {
} else {
}

if (foo) {
  if (bar) {
  } else {
  }
}

if (foo) {
  if (bar) {
  }
} else {
}
```

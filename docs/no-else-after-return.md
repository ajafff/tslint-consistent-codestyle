## no-else-after-return

Works like [no-else-return from eslint](http://eslint.org/docs/rules/no-else-return). This rule can automatically fix errors.

> If an if block contains a return statement, the else block becomes unnecessary. Its contents can be placed outside of the block.

If you like this rule, I recommend you try [`no-unnecessary-else`](./no-unnecessary-else.md) for some bonus features.

### Options

#### `"allow-else-if"`

Example config:

```js
"no-else-after-return": {
  "options": "allow-else-if"
}

// or

"no-else-after-return": [true, "allow-else-if"]
```

Enable this option if you prefer `else if` blocks after `return` statements:

```js
if (condition) {
  return 'foo';
} else if (otherCondition) { // this is allowed with the option
  return 'bar';
}

if (condition) {
  return 'foo';
} else if (otherCondition) {
  return 'bar';
} else { // this is still not allowed with the option
  return 'baz';
}
```

## no-return-undefined

Using `return undefined` or `return void 0;` is unnecessary, because `undefined` is the default return value. Just use `return;` instead.

### Options

#### `"allow-void-expression"`

Allows the use of void expressions like `return void callback()` or `return void (foo = bar)`.
Using the void keyword with a static expression like `return void 0` is still not allowed, as this serves no real purpose.

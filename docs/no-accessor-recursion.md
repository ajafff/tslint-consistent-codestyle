## no-accessor-recursion

This rule warns about accessing a property inside an accessor with the same name.
This is most likely a typo which causes infinite recursion. You probably meant to access a private property instead.

```ts
// Not passing
let obj = {
  get foo() {
    return this.foo;
  },
  set foo(v) {
    this.foo = v;
  }
}

// Passing
let obj = {
  get foo() {
    return this._foo;
  },
  set foo(v) {
    this._foo = v;
  },
  get bar() {
    return that.bar;
  },
  set bar(v) {
    that.bar = v;
  }
}
```

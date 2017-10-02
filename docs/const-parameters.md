## const-parameters

Disallows reassigning parameters that are considered constants. This rule is similar to tslint's [`no-parameter-reassignent`](https://palantir.github.io/tslint/rules/no-parameter-reassignment/) but allows you to explicitly declare which parameter is a constant with JsDoc `/** @const */`

```ts
function fn(/**@const*/foo, bar) {
  foo++; // error on this line
  bar++; // no error
}

class C {
  constructor(/** @const */ public foo) {
    foo++; // error on this line
    this.foo++; // no error on this line, because only parameters are checked by this rule
  }
}

function fn(/**@constant*/foo) { // also works with @constant tag
  foo++; // error on this line
}

function fn({ // also works with destructured parameters
  /**@const*/ foo,
  baz: /**@const*/ bar,
}) {
  foo++; // error on this line
  bar++; // error on this line
}
```

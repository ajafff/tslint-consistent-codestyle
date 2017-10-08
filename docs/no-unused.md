## no-unused

Disallows unused imports, variables, functions, classes, type parameters and more. Similar to `tsc`’s `--noUnusedParameters` and `--noUnusedLocals` options and the `tslint` core rule `no-unused-variable`.

Use `no-unused-expression` in addition to this rule to uncover even more dead code.

### Differences to `--noUnusedParameters` and `--noUnusedLocals`

* Errors can be disabled and don't fail compilation.

### Differences to `no-unused-variable`

* Works without the type checker and therefore without `--project` option.
* Works for .js files.
* No false positives with parameters of abstract methods.
* No false positives with destructuring. See [tslint#2876](https://github.com/palantir/tslint/issues/2876)
* No side effects on typescript's type system. See [tslint#2736](https://github.com/palantir/tslint/issues/2736) [tslint#2649](https://github.com/palantir/tslint/issues/2649) [tslint#2571](https://github.com/palantir/tslint/issues/2571)
* Only fixes unused names of function and class expressions.
* Cannot check if an import is implicitly used by the declaration emitter, but you can disable errors on imports in .ts files with `"ignore-imports"`

### Differences to both

* Can optionally complain about named function and class expressions that are never used by name with options `"unused-function-expression-name"` and `"unused-class-expression-name"`
* Can optionally complain about unused catch bindings (supported since typescript@2.5.1) with option `"unused-catch-binding"`
* Does not check private class members.
* Does not check for unused labels.
* Needs to be more liberal with variables in global scope, e.g. top level variable declarations if the file has no imports or exports.
* Flags write only variables as error. (Also supported by typescript@2.6.0)
* Flags functions and classes that are only used inside of their declaration as error.
* Handles declarations in different domains separately:

```ts
interface T {}
       // ~ [Interface 'T' is unused.]
class T {}
export = new T();

interface U {}
namespace U {}
       // ~ [Namespace 'U' is unused.]
export let v: U;
```

### Ignoring uninteresting parameters and variables

There are cases where you simply need to have a parameter or variable, but don't use it. You can prefix the name with an underscore `_` to ignore it.

The underscore works in the following cases:

1. Parameters
2. Object destructuring that contains rest
3. `for ... in` and `for ... of` loops

```ts
/* 1 */
function doStuff(_a, _b, c) {
    return c;
}

/* 2 */
let {a: _a, ...bAndC} = {a: 1, b: 2, c: 3};

/* 3 */
for (const _ in someObj)
    ++keyCount;
for (const _ of someArr)
    ++valueCount;
```

### Options

#### `"ignore-imports"`

When using `--declaration` in your `tsconfig.json`, the declaration emitter may implicitly use otherwise unused imports (See [TypeScript#9944](https://github.com/Microsoft/TypeScript/issues/9944)). You can either disable the error on those imports or use the `"ignore-imports"` option to ignore imports in all .ts files completely.

#### `"ignore-parameters"`

Disable errors on unused parameters. This does not include destructured parameters.

#### `"unused-function-expression-name"`

*Enables* checking for named function expressions that are never used by name.

These names may serve a purpose in your code, e.g. for easier debugging. Therefore this option is not enabled by default.

Not Passing:

```ts
setTimeout(function foo() { }, 100);
                 // ~~~ [Function 'foo' is never used by its name. Convert it to an anonymous function expression.]
```

Passing:

```ts
setTimeout(function() { }, 100);

let result = (function fac(i) {
    return i === 1 ? 1 : i * fac(i - 1);
})(5);
```

#### `"unused-class-expression-name"`

Basically the same as `"unused-function-expression-name"` but for class expressions.

#### `"unused-catch-binding"`

As of TypeScript@2.5.1 you can omit the catch binding if you're not going to use it. This option helps you identify such cases.

Not Passing:

```ts
try {
  JSON.parse(foo);
} catch (e) {
      // ~ [Variable 'e' is unused.]
  console.log('invalid json');
}
```

Passing:

```ts
try {
  JSON.parse(foo);
} catch {
  console.log('invalid json');
}
```

# Purpose

The rules in this package can be used to enforce consistent code style.

# Usage

Install from npm to your devDependencies  (https://www.npmjs.com/package/tslint-consistent-codestyle)

```
npm install --save-dev tslint-consistent-codestyle
```

Configure tslint to use the tslint-consistent-codestyle folder:

Add the following path to the `rulesDirectory` setting in your `tslint.json` file:

```
{
   "rulesDirectory": ["node_modules/tslint-consistent-codestyle/rules"]
   "rules": {
     ...
   }
}
```

Now configure some of the new rules.

# Rules

## naming-convention
Enforce consistent names for almost everything.

## no-else-after-return
Works like [no-else-return from eslint](http://eslint.org/docs/rules/no-else-return).

> If an if block contains a return statement, the else block becomes unnecessary. Its contents can be placed outside of the block.

## no-return-undefined
Using `return undefined` or `return void 0` is unnecessary, because `undefined` is the default return value. Just use `return;` instead.

## no-var-before-return
> Declaring a variable only to immediately return it is a **bad practice**. Some developers argue that the practice improves code readability, because it enables them to explicitly name what is being returned. However, this variable is an internal implementation detail that is not exposed to the callers of the method. **The method name should be sufficient for callers to know exactly what will be returned.**

This rule checks, if the last variable declared in a variable declaration right before the return statement contains the returned variable.
Destructuring assignments are also checked because `let {foo} = bar; return foo;` can also be written as `return bar.foo;`.
But if the destructuring assignment for this variable contains a default value other than `undefined` or `void`, there will be no error.

## parameter-properties
Usage:
```javascript
"parameter-properties": [
  true,
  "all-or-none",   // forces all or none of a constructors parameters to be parameter properties
  "leading",       // forces parameter properties to precede regular parameters
  "member-access", // forces an access modifier for every parameter property
  "readonly"       // forces all parameter properties to be readonly
]
```

All rule options are optional, but without any option this rule does nothing.

## parameter-properties [WIP]
Flags all enum declarations, if enum can be declared as constant. That is: there is no dynamic member access and the enum object is never assigned or passed to anything.

__Current limitations:__
* no support for scopes
* doesn't ignore exported enums (maybe add option)
* doesn't detect if enum is assigned to variable or passed as function parameter
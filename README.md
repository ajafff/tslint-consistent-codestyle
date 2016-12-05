# Purpose

The rules in this package can be used to enforce consistent code style.

# Usage

Install from npm to your devDependencies  (https://www.npmjs.com/package/tslint-consistent-codestyle)

```
npm install --save-dev tslint-consistent-codestyle
```

Configure tslint to use the tslint-consistent-codestyle folder:

Add the following path to the `rulesDirectory` setting in your `tslint.json` file:

```json
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

Docs are comming soon, sorry.

Meanwhile you can have a look at the [configuration I use in this project](https://github.com/ajafff/tslint-consistent-codestyle/blob/master/tslint.json#L93-L106).

## no-collapsible-if
*Tired of unnecessarily deep nested if blocks?*
This rule comes to rescue you.

Not passing:
```javascript
if (foo)
  if (bar);

if (foo) {
  if (bar) {
  }
}

if (foo) {
} else {
  if (bar) {
  } else {
  }
}
```
Passing:
```javascript
if (foo && bar);

if (foo && bar) {
}

if (foo) {
} else if (bar) {
} else {
}

if (foo) {
  if (bar) {
  } else {
  }
}
```
I recommend you use this rule together with one of [no-else-after-return](#no-else-after-return) or [no-unnecessary-else](#no-unnecessary-else) to further reduce block nesting.

## no-else-after-return
Works like [no-else-return from eslint](http://eslint.org/docs/rules/no-else-return).

> If an if block contains a return statement, the else block becomes unnecessary. Its contents can be placed outside of the block.

If you like this rule, I recommend you try [no-unnecessary-else](#no-unnecessary-else) for some bonus features.

## no-return-undefined
Using `return undefined` or `return void 0` is unnecessary, because `undefined` is the default return value. Just use `return;` instead.

## no-static-this
Ban the use of `this` in static methods.

__Rationale:__ It's pretty hard to wrap your head around the meaning of `this` in a static context. Especially newcomers will not recognise, that you are in fact referencing the `class` (or the `constructor` to be more precise).

## no-unnecessary-else
Works like [no-else-after-return](#no-else-after-return) with additional checks. This rule gives you hints for unnecessary else blocks after `throw`, `continue` and `break`(if not used within a switch block) for free. Just change `no-else-after-return` to `no-unnecessary-else` in your `tslint.json`.

## no-var-before-return
> Declaring a variable only to immediately return it is a **bad practice**. Some developers argue that the practice improves code readability, because it enables them to explicitly name what is being returned. However, this variable is an internal implementation detail that is not exposed to the callers of the method. **The method name should be sufficient for callers to know exactly what will be returned.**

This rule checks, if the last variable declared in a variable declaration right before the return statement contains the returned variable.
Destructuring assignments are also checked because `let {foo} = bar; return foo;` can also be written as `return bar.foo;`.
But if the destructuring assignment for this variable contains a default value other than `undefined` or `void`, there will be no error.

## parameter-properties
Usage:
```json
"parameter-properties": [
  true,
  "all-or-none",   // forces all or none of a constructors parameters to be parameter properties
  "leading",       // forces parameter properties to precede regular parameters
  "member-access", // forces an access modifier for every parameter property
  "readonly"       // forces all parameter properties to be readonly
]
```

All rule options are optional, but without any option this rule does nothing.

## prefer-const-enum [WIP]
Flags all enum declarations, if enum can be declared as constant. That is: there is no dynamic member access and the enum object is never assigned or passed to anything.

__Current limitations:__
* no support for scopes
* doesn't ignore exported enums (maybe add option or use `preserveConstEnums` compiler flag)
* doesn't detect if enum is assigned to variable or passed as function parameter

## prefer-while
A `for`-loop without initializer and incrementer can also be rewritten as `while`-loop. That's what this rule does.
It can also automatically fix any finding, if you set the `--fix` command line switch for `tslint`.
[![npm version](http://img.shields.io/npm/v/tslint-consistent-codestyle.svg)](https://npmjs.org/package/tslint-consistent-codestyle)
[![Downloads](http://img.shields.io/npm/dm/tslint-consistent-codestyle.svg)](https://npmjs.org/package/tslint-consistent-codestyle)
[![CircleCI](https://circleci.com/gh/ajafff/tslint-consistent-codestyle.svg?style=shield)](https://circleci.com/gh/ajafff/tslint-consistent-codestyle)
[![Coverage Status](https://coveralls.io/repos/github/ajafff/tslint-consistent-codestyle/badge.svg)](https://coveralls.io/github/ajafff/tslint-consistent-codestyle)

# Purpose

[![Join the chat at https://gitter.im/ajafff/tslint-consistent-codestyle](https://badges.gitter.im/ajafff/tslint-consistent-codestyle.svg)](https://gitter.im/ajafff/tslint-consistent-codestyle?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

The rules in this package can be used to enforce consistent code style.

# Usage

Install from npm to your devDependencies  (https://www.npmjs.com/package/tslint-consistent-codestyle)

```
npm install --save-dev tslint-consistent-codestyle
```

Configure tslint to use `tslint-consistent-codestyle`:

This package provides an empty configuration preset that just contains the `rulesDirectory`. That means you can easily use the rules in this package, but don't get any predefined configuration. To use it, just add it to the `extends` array in your `tslint.json`:

```javascript
{
   "extends": ["tslint-consistent-codestyle"]
   "rules": {
     ...
   }
}
```

As of `tslint@5.2.0` you can also use `tslint-consistent-codestyle` as `rulesDirectory`:

```javascript
{
   "rulesDirectory": ["tslint-consistent-codestyle"]
   "rules": {
     ...
   }
}
```

Now configure some of the new rules.

# Rules

## ext-curly
Enforces (not) to use curly braces when necessary. If you only want `"always"` or `"never"`, use the `curly` rule of tslint core instead.

This rule defaults to never allow curly bracen when not necessary. There are several options that let you specify when you want to use curly braces for consistency:

* `"consistent"`: enforces curly braces on *all* branches of an `if-else` when one needs braces.
* `"else"`: enforces curly braces on all branches of an `if` statement if it contains an else statement. This option is a superset of `"consistent"`.
* `"braced-child"`: enforces curly braces if the child statement has or needs curly braces. That includes `try...catch`, `switch`, `while` or `for` loops and `if` statements where at least one branch has curly braces.
* `"nested-if-else"`: enforces curly braces when the nested statement is an `if` statement with an `else` branch.

This rule can automatically fix unnecessary curly braces.

## naming-convention
Enforce consistent names for almost everything.

This rule is configured with an array of configuration objects. All of those objects are made up of 2 parts. The first could be called the "selector", because it describes, *what* is affected by this config. The second part consists of one or more formatting rules.

So for example, if you want to force every local variable to be in camelCase, you simply write the config as shown below:
```javascript
{
  "type": "variable",
  "modifiers": "local",
  "format": "camelCase"
}
```

### Selector:

* `type: string`: The selector consists of a required field `type`, which identifies the type of thing this configuration applies to.
* `modifiers?: string|string[]`: To further specify your selection you can provide one or more `modifiers`. All of those modifiers must match an identifier, to activate this config. That means `["global", "const"]` will match every constant in global scope. It will not match any not-const global. Some of those modifiers are mutually exclusive, so you will never match anything if you specify more than one of them, for example `global` and `local` or the access modifiers `private`, `protected` and `public`.
* `final?: boolean`: If set to true, this configuration will not contribute to the composition of any subtype's configuration.
* `filter?: string`: Regular expression to limit the scope of this configuration to names that match this regex.

### Formatting rules:

All formatting rules are optional. Formatting rules are inherited by the `type`'s parent type. You can shadow the parent config by setting a new rule for the desired check or even disable the check by setting any falsy value.

* `regex: string`: A regular expression, which is applied to the name. (without any regex flags)
* `leadingUnderscore: string, trailingUnderscore: string`: Options `forbid`, `allow` and `require` can be used to forbid, allow or require _one_ leading or trailing underscore in the name. **If one option is specified, the leading or trailing underscore will be sliced off the name before any further checks are performed.**
* `prefix: string|string[], suffix: string|string[]`: Specify one or more prefixes or suffixes. When given a single string, that string must match in the specified position. When given an array, one of the strings must match in the specified position. Matching is done in the given order. **If a prefix or suffix is specified, the matching portion of the name is sliced off before any further checks are performed:** If you enforce `camelCase` and a prefix `has`, the name `hasFoo` will not match. That's because the prefix `has` is removed and the remaining `Foo` is not valid `camelCase`
* `format: string|string[]`: Valid options are `camelCase`, `PascalCase`, `UPPER_CASE` and `snake_case`. If an array is given, the name must match one format in that array. If the array is empty, no format check is made.

### "Inheritance" / Extending configurations:

As mentioned above, a type's configuration is used as base for the configuration of all of it's subtypes. Of course the subtype can override any inherited configuration option by providing a new value or disable it by setting any falsy value.

For example there is a base type `default` that applies to every other type, if it is not declared as `final`.
We will cover that concept later in the examples section.

### Ordering

You do not have to order your configurations. In fact the order is completely irrelevant, since everything is sorted internally.

The first sort criteria is the type. They are sorted base first, subclass last, as presented in section [Types](#types).
In the second pass, rules with equal type are sorted by "modifier specifity".
This means, every modifier has a specify associated with it. All modifiers for one configuration are added to get the second sort criteria.

Specifity:

* `const` = `readonly` = 1,
* `static` = `global` = `local` = 2,
* `public` = `protected` = `private` = 4,
* `abstract` = 8,
* `export` = 16,
* `rename` = 64,

### Configuration composition

Now that we covered the sorting of configurations, we will see how they will contribute to the final config for an identifier.

First, we filter by type. That leaves us with all configs for the current type and all of its base types (if their config is not `final`).
Second, we filter by modifiers. All configs match, that have no excess modifiers specified match (less is ok, more is not ok).

After filtering the formatting rules are reduced from the first to the last. Remember, the most generic base type config is first and the most specific subtype config is last. After that, all formatting rules, that have no falsy values, are applied to the identifier name.

### Types
#### default

* Scope: is the base for everything
* Valid modifiers: refer to subtypes


#### variable

* Scope: every variable declared with `var`, `let` and `const`
* Extends: `default`
* Valid modifiers:
  * `global` or `local`
  * `const`
  * `export`
  * `rename` // if you rename a property in a destructuring assignment, e.g. `let {foo: myFoo} = bar`


#### function

* Scope: every function and named function expression
* Extends: `variable`
* Valid modifiers:
  * `global` or `local`
  * `export`


#### parameter

* Scope: parameters
* Extends: `variable`, always has `local` modifier
* Valid modifiers:
  * `rename`


#### member

* Scope: used as superclass for `property`, `method`, ...
* Extends: `default`
* Valid modifiers: refer to subtypes


#### property

* Scope: class properties (static and instance)
* Extends: `member`
* Valid modifiers:
  * `private`, `protected` or `public`
  * `static`
  * `const` == `readonly` // can be used interchangeably. internally both are handled as `const`
  * `abstract` // for abstract property accessors


#### parameterProperty

* Scope: class constructor's parameter properties
* Extends: `property` and `parameter`, always has `local` modifier
* Valid modifiers:
  * `private`, `protected` or `public`
  * `const` == `readonly`


#### enumMember

* Scope: all members of enums
* Extends: `property`, always has `public`, `static`, `const`/`readonly` modifiers
* Valid modifiers:
  * everything from type `enum`


#### method

* Scope: class methods (static and instance)
* Extends: `member`
* Valid modifiers:
  * `private`, `protected` or `public`
  * `static`
  * `abstract`


#### type

* Scope: used as superclass for `class`, `interface`, ...
* Extends: `default`
* Valid modifiers: refer to subtypes


#### class

* Scope: all classes and named class expressions
* Extends: `type`
* Valid modifiers:
  * `global` or `local`
  * `abstract`
  * `export`


#### interface

* Scope: all interfaces
* Extends: `type`
* Valid modifiers:
  * `global` or `local`
  * `export`


#### typeAlias

* Scope: all type aliases, e.g. `type Foo = "a" | "b"`
* Extends: `type`
* Valid modifiers:
  * `global` or `local`
  * `export`


#### genericTypeParameter

* Scope: all generic type parameters, e.g. `class Foo<T, U> {}` or `function<T>(v: T): T {}`
* Extends: `type`
* Valid modifiers:
  * `global` _if found on a class_ or `local` _if found on a function_


#### enum

* Scope: all enums
* Extends: `type`
* Valid modifiers:
  * `global` or `local`
  * `const`
  * `export`

### Examples
Here you see an example of how everything explained above works together. This is the configuration used in this project.

```javascript
"naming-convention": [
  true,
  // forbid leading and trailing underscores and enforce camelCase on EVERY name. will be overridden by subtypes if needed
  {"type": "default", "format": "camelCase", "leadingUnderscore": "forbid", "trailingUnderscore": "forbid"},
  // require all global constants to be camelCase or UPPER_CASE
  // all other variables and functions still need to be camelCase
  {"type": "variable", "modifiers": ["global", "const"], "format": ["camelCase","UPPER_CASE"]},
  // override the above format option for exported constants to allow only UPPER_CASE
  {"type": "variable", "modifiers": ["export", "const"], "format": "UPPER_CASE"},
  // allow leading underscores for parameters, because `tsc --noUnusedParameters` will not flag underscore prefixed parameters
  // all other rules (trailingUnderscore: forbid, format: camelCase) still apply
  // since we don't want to inherit this config to `parameterProperties`, we set `final = true`
  {"type": "parameter", "leadingUnderscore": "allow", "final": true},
  // require leading underscores for private properties and methods, all other rules still apply
  {"type": "member", "modifiers": "private", "leadingUnderscore": "require"},
  // same for protected
  {"type": "member", "modifiers": "protected", "leadingUnderscore": "require"},
  // exclicitly disable the format check only for method toJSON
  {"type": "method", "filter": "^toJSON$", "format": null},
  // enforce UPPER_CASE for all public static readonly(!) properties
  {"type": "property", "modifiers": ["public", "static", "const"], "format": "UPPER_CASE"},
  // enforce PascalCase for classes, interfaces, enums, etc. Remember, there are still no underscores allowed.
  {"type": "type", "format": "PascalCase"},
  // abstract classes must have the prefix "Abstract". The following part of the name must be valid PascalCase
  {"type": "class", "modifiers": "abstract", "prefix": "Abstract"},
  // interface names must start with "I". The following part of the name must be valid PascalCase
  {"type": "interface", "prefix": "I"},
  // generic type parameters must start with "T"
  // most of the time it will only be T, which is totally valid, because an empty string conforms to the PascalCase check
  // By convention T, U and V are used for generics. You could enforce that with "regex": "^[TUV]$" and if you are care that much for performance, you could disable every other check by setting a falsy value
  {"type": "genericTypeParameter", "prefix": "T"},
  // enum members must be in PascalCase. Without this config, enumMember would inherit UPPER_CASE from public static const property
  {"type": "enumMember", "format": "PascalCase"}
]
```

## no-as-type-assertion
The complete opposite of the tslint core rule `no-angle-bracket-type-assertion` plus the ability to automatically fix all findings.

I added this rule for completeness and because I find it more readable this way.

## no-collapsible-if
*Tired of unnecessarily deep nested if blocks?*
This rule comes to rescue you.

Not passing:
```javascript
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
```javascript
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
I recommend you use this rule together with [no-else-after-return](#no-else-after-return) or [no-unnecessary-else](#no-unnecessary-else) to further reduce block nesting.

## no-else-after-return
Works like [no-else-return from eslint](http://eslint.org/docs/rules/no-else-return).

> If an if block contains a return statement, the else block becomes unnecessary. Its contents can be placed outside of the block.

If you like this rule, I recommend you try [no-unnecessary-else](#no-unnecessary-else) for some bonus features.

## no-return-undefined
Using `return undefined` or `return void 0` is unnecessary, because `undefined` is the default return value. Just use `return;` instead.

### allow-void-expression
Option `"allow-void-expression"` allows the usage of void expressions like `return void callback()` or `return foo = bar`.
Using the void keyword with a static expression like `return void 0` is still not allowed, as this has no benefit.

## no-static-this
Ban the use of `this` in static methods.

__Rationale:__ It's pretty hard to wrap your head around the meaning of `this` in a static context. Especially newcomers will not recognise, that you are in fact referencing the `class` (or the `constructor` to be more precise).

## no-unnecessary-else
Works like [no-else-after-return](#no-else-after-return) with additional checks. This rule gives you hints for unnecessary else blocks after `throw`, `continue` and `break`(if not used within a switch block) for free. Just change `no-else-after-return` to `no-unnecessary-else` in your `tslint.json`.

## no-var-before-return
> Declaring a variable only to immediately return it is a **bad practice**. Some developers argue that the practice improves code readability, because it enables them to explicitly name what is being returned. However, this variable is an internal implementation detail that is not exposed to the callers of the method. **The method name should be sufficient for callers to know exactly what will be returned.**

This rule checks, if the last variable declared in a variable declaration right before the return statement contains the returned variable.
Destructuring is also checked because `let {foo} = bar; return foo;` can also be written as `return bar.foo;`.
If the destructuring of the variable has an initializer other than `void` or `undefined`, there will be no error.

## object-shorthand-properties-first
By convention and for better readability, shorthand properties should precede regular property declarations.

Not passing:
```javascript
let foo = {
  foo: foo,
  bar,
  baz: baz,
};
```

Passing:
```javascript
let foo = {
  bar,
  foo: foo,
  baz: baz,
};
```

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

## prefer-const-enum [WIP]
Flags enum declarations, which can be declared as constant. That is: there is no dynamic member access and the enum object is never assigned or passed to anything. This rule can automatically fix all findings.

__Current limitations:__
* no support for scopes
* exported enums are excluded (maybe add option or use `preserveConstEnums` compiler flag)

## prefer-while
A `for`-loop without initializer and incrementer can also be rewritten as `while`-loop. That's what this rule does.
It can also automatically fix any finding, if you set the `--fix` command line switch for `tslint`.

## early-exit

This recommends to use an early exit instead of a long `if` block.
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

# Recommendations

* [vrsource-tslint-rules](https://www.npmjs.com/package/vrsource-tslint-rules)
* [tslint-microsoft-contrib](https://www.npmjs.com/package/tslint-microsoft-contrib)
* [tslint-eslint-rules](https://www.npmjs.com/package/tslint-eslint-rules)

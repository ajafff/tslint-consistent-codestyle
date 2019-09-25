## naming-convention

Enforce consistent names for almost everything.

This rule is configured with an array of configuration objects. All of those objects are made up of 2 parts. The first could be called the "selector", because it describes, *what* is affected by this config. The second part consists of one or more formatting rules.

So for example, if you want to force every local variable to be in camelCase, you simply write the config as shown below:

```js
{
  "type": "variable",
  "modifiers": "local",
  "format": "camelCase"
}
```

### Selector

* `type: string`: The selector consists of a required field `type`, which identifies the type of thing this configuration applies to.
* `modifiers?: string|string[]`: To further specify your selection you can provide one or more `modifiers`. All of those modifiers must match an identifier, to activate this config. That means `["global", "const"]` will match every constant in global scope. It will not match any not-const global. Some of those modifiers are mutually exclusive, so you will never match anything if you specify more than one of them, for example `global` and `local` or the access modifiers `private`, `protected` and `public`.
* `final?: boolean`: If set to true, this configuration will not contribute to the composition of any subtype's configuration.
* `filter?: string`: Regular expression to limit the scope of this configuration to names that match this regex.

### Formatting rules

All formatting rules are optional. Formatting rules are inherited by the `type`'s parent type. You can shadow the parent config by setting a new rule for the desired check or even disable the check by setting any falsy value.

* `regex: string`: A regular expression, which is applied to the name. (without any regex flags)
* `leadingUnderscore: string, trailingUnderscore: string`: Options `forbid`, `allow` and `require` can be used to forbid, allow or require _one_ leading or trailing underscore in the name. **If one option is specified, the leading or trailing underscore will be sliced off the name before any further checks are performed.**
* `prefix: string|string[], suffix: string|string[]`: Specify one or more prefixes or suffixes. When given a single string, that string must match in the specified position. When given an array, one of the strings must match in the specified position. Matching is done in the given order. **If a prefix or suffix is specified, the matching portion of the name is sliced off before any further checks are performed:** If you enforce `camelCase` and a prefix `has`, the name `hasFoo` will not match. That's because the prefix `has` is removed and the remaining `Foo` is not valid `camelCase`
* `format: string|string[]`: Valid options are `camelCase`, `strictCamelCase`, `PascalCase`, `StrictPascalCase`, `UPPER_CASE` and `snake_case`. If an array is given, the name must match one format in that array. If the array is empty, no format check is made. The options `strictCamelCase` and `StrictPascalCase` enforce that there are no uppercase characters next to each other: `setID` is invalid and needs to be converted to `setId`.

### "Inheritance" / Extending configurations

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
* `unused` = 128

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
  * `unused` // if the variable is never used

#### function

* Scope: every function and named function expression
* Extends: `variable`
* Valid modifiers:
  * `global` or `local`
  * `export`

#### functionVariable

* Scope: every variable that is initialized with an arrow function or function expression
* Extends: `variable`
* Valid modifiers:
  * `global` or `local`
  * `const`
  * `export`
  * `unused` // if the variable is never used

#### parameter

* Scope: parameters
* Extends: `variable`, always has `local` modifier
* Valid modifiers:
  * `rename`
  * `unused` // parameters in overload signatures and ambient signatures are never considered unused

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
  * `abstract`

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

#### accessor

* Scope: all accessors (get, set)
* Extends: `member`
* Valid modifiers:
  * `private`, `protected` or `public`
  * `static`
  * `abstract`

### Examples

Here you see an example of how everything explained above works together. This is the configuration used in this project.

```js
"naming-convention": [
  true,
  // forbid leading and trailing underscores and enforce camelCase on EVERY name. will be overridden by subtypes if needed
  {"type": "default", "format": "camelCase", "leadingUnderscore": "forbid", "trailingUnderscore": "forbid"},
  // require all global constants to be camelCase or UPPER_CASE
  // all other variables and functions still need to be camelCase
  {"type": "variable", "modifiers": ["global", "const"], "format": ["camelCase","UPPER_CASE"]},
  // override the above format option for exported constants to allow only UPPER_CASE
  {"type": "variable", "modifiers": ["export", "const"], "format": "UPPER_CASE"},
  // require exported constant variables that are initialized with functions to be camelCase
  {"type": "functionVariable", "modifiers": ["export", "const"], "format": "camelCase"},
  // allow leading underscores for unused parameters, because `tsc --noUnusedParameters` will not flag underscore prefixed parameters
  // all other rules (trailingUnderscore: forbid, format: camelCase) still apply
  {"type": "parameter", "modifiers": "unused", "leadingUnderscore": "allow"},
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

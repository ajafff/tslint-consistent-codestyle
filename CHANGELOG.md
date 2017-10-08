# Change Log

## v1.8.0

**Bugfixes:**

* `no-as-type-assertion`
  * Insert fix at the correct position
  * Fixed ordering issues in fixer
  * The rule disables itself in `.jsx` and `.tsx` files

**Features:**

* `no-unused` adds option `"unused-catch-binding"` to disallow unused catch bindings. Only use this rule if you use TypeScript@2.5.1 or newer

## v1.7.0

**Features:**

* new rule [`const-parameters`](https://github.com/ajafff/tslint-consistent-codestyle/blob/master/docs/const-parameters.md)

## v1.6.0

**Bugfixes:**

* `prefer-const-enum` bail on string to number conversion
* `no-unused` fixed false positive with index signature

**Features:**

* `parameter-properties` adds `"trailing"` option

## v1.5.1

**Bugfixes:**

* `no-var-before-return` now detects if variable is used by a closure.
* `prefer-const-enum` is now stable:
  * Correct handling of scopes
  * Handle enums merging with namespace
  * Exclude enums in global scope
  * Handle string valued enums
  * Bugfix for enum used as type
  * Stricter checks for initializer

## v1.5.0

**Features:**

* :sparkles: New rule [`no-unused`](https://github.com/ajafff/tslint-consistent-codestyle/blob/master/docs/no-unused.md) to find dead code and unused declarations.
* New rule [`early-exit`](https://github.com/ajafff/tslint-consistent-codestyle/blob/master/docs/early-exit.md) recommends to use an early exit instead of a long `if` block. Big thanks to @andy-hanson for this great contribution.

## v1.4.0

**Features:**

* New rule `ext-curly` to enforce consistent use of curly braces.

**Bugfixes:**

* `no-var-before-return` now has an exception array destructuring because there could be an iterator being destructured.

## v1.3.0

**Features:**

* This package now contains an empty config that can easily be extended using `"extends": ["tslint-consistent-codestyle"]` in your `tslint.json`
* Add documentation about the module resolution of `rulesDirectory`

**Bugfixes:**

* Remove `no-curly` rule from package, which is still under development

## v1.2.0

**Features:**

* `naming-convention`: Allow an array of formats

**Bugfixes:**

* `naming-convention`:
  * `global` modifier now works correctly on functions, classes, enums, etc. Before they were all considered `local`
  * type `function` now correctly inherits from type `variable` instead of getting overridden depending on their ordering
  * Adding a `filter` to a configuration no longer overrides every other config in the inheritance chain

## v1.1.0

**Features:**

* `naming-convention`: Add `filter` option to config

## v1.0.0

**Breaking Changes:**

* Update to tslint@5
* Removed `prefer-static-method`, use tslint's `prefer-function-over-method` instead
* PascalCase and camelCase can no longer contain two adjacent uppercase characters
* UPPER_CASE and snake_case can no longer contain two adjacent underscores

**Bugfixes:**

* Exempt `this` parameter from name checks

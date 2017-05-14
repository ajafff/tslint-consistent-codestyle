# Change Log

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
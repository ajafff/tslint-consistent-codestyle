# Change Log

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
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

## no-var-before-return
Declaring a variable only to immediately return it is a **bad practice**. Some developers argue that the practice improves code readability, because it enables them to explicitly name what is being returned. However, this variable is an internal implementation detail that is not exposed to the callers of the method. **The method name should be sufficient for callers to know exactly what will be returned.**

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
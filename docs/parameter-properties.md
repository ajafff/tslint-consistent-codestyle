## parameter-properties

Configure how and where to declare parameter properties.

### Options

All rule options are optional, but without any option this rule does nothing.

Usage:

```js
"parameter-properties": [
  true,
  "all-or-none",   // forces all or none of a constructors parameters to be parameter properties
  "leading",       // forces parameter properties to precede regular parameters
  "trailing",      // forces regular parameters to precede parameter properties
  "member-access", // forces an access modifier for every parameter property
  "readonly"       // forces all parameter properties to be readonly
]
```

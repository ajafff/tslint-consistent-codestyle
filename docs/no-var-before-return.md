## no-var-before-return

Checks if the returned variable is declared right before the `return` statement.

> Declaring a variable only to immediately return it is a **bad practice**. Some developers argue that the practice improves code readability, because it enables them to explicitly name what is being returned. However, this variable is an internal implementation detail that is not exposed to the callers of the method. **The method name should be sufficient for callers to know exactly what will be returned.**

### Options

#### `"allow-destructuring"`

Allows destructuring a variable immediately before returning it.

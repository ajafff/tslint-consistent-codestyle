## prefer-while

A `for`-loop without initializer and incrementer can also be rewritten as `while`-loop. This rule can automatically fix errors.

:warning: As of TSLint v5.10.0 this rule is a TSLint core rule. You will no longer be able to use the rule from this package.

```ts
for (;;)
    doStuff();

for (;condition;)
    doOtherStuff();

// Prefer
while (true)
    doStuff();

while (condition)
    doOtherStuff();
```

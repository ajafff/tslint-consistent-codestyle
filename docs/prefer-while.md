## prefer-while

A `for`-loop without initializer and incrementer can also be rewritten as `while`-loop. This rule can automatically fix errors.

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

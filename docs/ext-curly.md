## ext-curly

Enforces where to consistently use curly braces where not strictly necessary. If you only want `"always"` or `"as-needed"`, use the `curly` rule of tslint core instead.

This rule defaults to never allow curly bracen when not necessary.

Unnecessary braces can be automatically fixed.

### Options

There are several options that let you specify when you want to use curly braces for consistency. All options can be used together.

#### `"consistent"`

Enforces curly braces on *all* branches of an `if-else` when one branch needs braces.

```ts
// Not Passing
if (foo) {
    if (bar)
        foo(bar)
} else
    baz(); // the if then branch requires braces, therefore the else branch also needs them

if (foo) foo() // this branch needs to get braces
else if (bar) bar() // this branch needs to get braces
else {}

// Passing
if (foo)
    foo()

if (foo)
    foo()
else
    bar()

if (foo)
    foo()
else if (bar)
    bar()
else
    baz()
```

#### `"else"`

Enforces curly braces on all branches of an `if` statement if it contains an else statement. This option is a superset of `"consistent"`.

```ts
// Not passing
if (foo) foo()
else bar() // both branches need to get braces

// Passing
if (foo)
    foo()

```

#### `"braced-child"`

Enforces curly braces if the child statement has or needs curly braces. That includes `try...catch`, `switch`, `while` or `for` loops and `if` statements where at least one branch has curly braces.

```ts
// Not passing
if (foo) // if statement needs braces
    switch (foo.bar) {
        default:
    }

while (true) // while statement needs braces
    try {
        doStuff()
    } catch (e) {}

for (;;) // for statement needs braces
    if (foo) {
        foo();
        bar();
    } else
        baz();
```

#### `"nested-if-else"`

Enforces curly braces when the nested statement is an `if` statement with an `else` branch.

```ts
// Not passing
for (;;) // for statement needs braces
    if (foo)
        foo();
    else
        baz();
```
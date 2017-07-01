## prefer-const-enum

An enum that is never dynamically accessed, can be declared as `const enum`.
Const enums are replaced with their number or string values during compilation.
That can yield a significant performance increase for heavily used enums.
This rule identifies enums that could be const enums and can automatically fix them.

Enums that are exported or available in the global scope are ignored.

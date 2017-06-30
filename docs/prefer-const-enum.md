## prefer-const-enum

An enum that is never dynamically accessed, can be declared as `const enum`.
Const enums are replaces with their number or string values by the compiler.
That can yield a significant performance increase for heavily used enums.
This rule identifies enums that could be const enums and can automatically fix them.

__:exclamation: This rule is still a work in progress. Current limitations:__
* no support for scopes
* exported enums are ignored

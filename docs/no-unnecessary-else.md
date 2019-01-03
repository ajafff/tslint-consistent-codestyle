## no-unnecessary-else

If an if block contains a return, throw, continue or break statement, the else block becomes unnecessary. Its contents can be placed outside of the block. This rule can automatically fix errors.

This is basically [no-else-after-return](./no-else-after-return.md) with additional checks including `throw`, `continue` and `break`. Replace `no-else-after-return` with `no-unnecessary-else` in your `tslint.json`.

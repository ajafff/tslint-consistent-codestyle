## no-static-this

Ban the use of `this` in static methods.

__Rationale:__ It's pretty hard to wrap your head around the meaning of `this` in a static context. Especially newcomers will not recognise, that you are in fact referencing the `class` (or the `constructor` to be more precise).

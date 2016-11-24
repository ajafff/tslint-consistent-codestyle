#!/bin/bash
set -v

./node_modules/.bin/tsc -p .

find test -type f -name '*.lint' -exec dirname {} \; | sort -u | xargs -n 1 ./node_modules/.bin/tslint --test

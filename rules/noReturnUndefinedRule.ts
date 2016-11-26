import * as ts from 'typescript';
import * as Lint from 'tslint';

import {isUndefined} from '../src/utils';
import {ReturnStatementWalker} from '../src/walker';

const FAIL_MESSAGE = `don't return undefined or void`;

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new ReturnWalker(sourceFile, this.getOptions()));
    }
}

class ReturnWalker extends ReturnStatementWalker {
    public visitReturnStatement(node: ts.ReturnStatement) {
        if (node.expression !== undefined && isUndefined(node.expression)) {
            const sourceFile = this.getSourceFile();
            this.addFailure(this.createFailure(node.expression.getStart(sourceFile),
                                               node.expression.getWidth(sourceFile),
                                               FAIL_MESSAGE));
        }
    }
}

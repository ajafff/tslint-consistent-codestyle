import * as ts from 'typescript';
import * as Lint from 'tslint';

import { isElseIf } from '../src/utils';
import { AbstractIfStatementWalker } from '../src/walker';
import { getControlFlowEnd, isReturnStatement } from 'tsutils';

const FAIL_MESSAGE = `unnecessary else after return`;

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new IfWalker(sourceFile, this.ruleName, undefined));
    }
}

class IfWalker extends AbstractIfStatementWalker<void> {
    protected _checkIfStatement(node: ts.IfStatement) {
        if (
            node.elseStatement !== undefined &&
            !isElseIf(node) &&
            endsWithReturnStatement(node.thenStatement)
        )
            this.addFailureAtNode(node.getChildAt(5 /*else*/, this.sourceFile), FAIL_MESSAGE);
    }
}

function endsWithReturnStatement(node: ts.Statement): boolean {
    const end = getControlFlowEnd(node);
    return end.end && end.statements.every(isReturnStatement);
}

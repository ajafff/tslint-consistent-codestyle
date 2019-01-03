import * as ts from 'typescript';
import * as Lint from 'tslint';

import { isElseIf } from '../src/utils';
import { AbstractIfStatementWalker } from '../src/walker';
import { isIfStatement, getControlFlowEnd, isReturnStatement } from 'tsutils';

const FAIL_MESSAGE = `unnecessary else after return`;
const OPTION_ALLOW_ELSE_IF = 'allow-else-if';

interface IOptions {
    allowElseIf: boolean;
}

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new IfWalker(sourceFile, this.ruleName, {
            allowElseIf: this.ruleArguments.indexOf(OPTION_ALLOW_ELSE_IF) !== -1,
        }));
    }
}

class IfWalker extends AbstractIfStatementWalker<IOptions> {
    protected _checkIfStatement(node: ts.IfStatement) {
        if (shouldCheckNode(node, this.options.allowElseIf) && endsWithReturnStatement(node.thenStatement))
            this._reportUnnecessaryElse(node.elseStatement, FAIL_MESSAGE);
    }
}

function shouldCheckNode(node: ts.IfStatement, allowElseIf: boolean): node is ts.IfStatement & {elseStatement: {}} {
    if (node.elseStatement === undefined)
        return false;
    if (!allowElseIf)
        return !isElseIf(node);
    if (isIfStatement(node.elseStatement) && isElseIf(node.elseStatement))
        return false;
    while (isElseIf(node)) {
        node = node.parent;
        if (!endsWithReturnStatement(node.thenStatement))
            return false;
    }
    return true;
}

function endsWithReturnStatement(node: ts.Statement): boolean {
    const end = getControlFlowEnd(node);
    return end.end && end.statements.every(isReturnStatement);
}

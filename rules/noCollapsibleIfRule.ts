import * as ts from 'typescript';
import * as Lint from 'tslint';
import * as utils from 'tsutils';

import { AbstractIfStatementWalker } from '../src/walker';

const FAIL_MERGE_IF = `if statements can be merged`;
const FAIL_MERGE_ELSE_IF = `if statement can be merged with previous else`;

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new CollapsibleIfWalker(sourceFile, this.ruleName, undefined));
    }
}

class CollapsibleIfWalker extends AbstractIfStatementWalker<void> {
    protected _checkIfStatement(node: ts.IfStatement) {
        if (node.elseStatement === undefined) {
            let then = node.thenStatement;
            if (utils.isBlockLike(then) && then.statements.length === 1)
                then = then.statements[0];
            if (utils.isIfStatement(then) && then.elseStatement === undefined) {
                const end = utils.getChildOfKind(then, ts.SyntaxKind.CloseParenToken, this.sourceFile)!.end;
                this.addFailure(node.getStart(this.sourceFile), end, FAIL_MERGE_IF);
            }
        } else if (utils.isBlockLike(node.elseStatement) &&
                   node.elseStatement.statements.length === 1 &&
                   utils.isIfStatement(node.elseStatement.statements[0])) {
            const start = utils.getChildOfKind(node, ts.SyntaxKind.ElseKeyword, this.sourceFile)!.getStart(this.sourceFile);
            const end = utils.getChildOfKind(node.elseStatement.statements[0], ts.SyntaxKind.CloseParenToken, this.sourceFile)!.end;
            this.addFailure(start, end, FAIL_MERGE_ELSE_IF);
        }
    }
}

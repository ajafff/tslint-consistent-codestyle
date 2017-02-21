import * as ts from 'typescript';
import * as Lint from 'tslint';
import * as utils from 'tsutils';

import { IfStatementWalker } from '../src/walker';

const FAIL_MERGE_IF = `if statements can be merged`;
const FAIL_MERGE_ELSE_IF = `if statement can be merged with previous else`;

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new CollapsibleIfWalker(sourceFile, this.getOptions()));
    }
}

class CollapsibleIfWalker extends IfStatementWalker {
    public visitIfStatement(node: ts.IfStatement) {
        if (node.elseStatement === undefined) {
            let then = node.thenStatement;
            if (utils.isBlockLike(then) && then.statements.length === 1)
                then = then.statements[0];
            if (utils.isIfStatement(then) && then.elseStatement === undefined) {
                const end = utils.getChildOfKind(then, ts.SyntaxKind.CloseParenToken, this.getSourceFile())!.getEnd();
                this.addFailureFromStartToEnd(node.getStart(this.getSourceFile()), end, FAIL_MERGE_IF);
            }
        } else if (utils.isBlockLike(node.elseStatement) &&
            node.elseStatement.statements.length === 1 &&
            utils.isIfStatement(node.elseStatement.statements[0])) {

            const sourceFile = this.getSourceFile();
            const start = utils.getChildOfKind(node, ts.SyntaxKind.ElseKeyword, sourceFile)!.getStart(sourceFile);
            const end = utils.getChildOfKind(node.elseStatement.statements[0], ts.SyntaxKind.CloseParenToken, sourceFile)!.getEnd();
            this.addFailureFromStartToEnd(start, end, FAIL_MERGE_ELSE_IF);
        }
    }
}

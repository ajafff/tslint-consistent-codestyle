import * as ts from 'typescript';
import * as Lint from 'tslint';

import { getChildOfKind } from '../src/utils';
import { isBlockLike, isIfStatement } from '../src/typeguard';
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
            if (isBlockLike(then) && then.statements.length === 1)
                then = then.statements[0];
            if (isIfStatement(then) && then.elseStatement === undefined) {
                const sourceFile = this.getSourceFile();
                const start = node.getStart(sourceFile);
                const width = getChildOfKind(then, ts.SyntaxKind.CloseParenToken, sourceFile)!.getEnd() - start;
                this.addFailure(this.createFailure(start, width, FAIL_MERGE_IF));
            }
        } else if (isBlockLike(node.elseStatement) &&
            node.elseStatement.statements.length === 1 &&
            isIfStatement(node.elseStatement.statements[0])) {
            const sourceFile = this.getSourceFile();
            const start = getChildOfKind(node, ts.SyntaxKind.ElseKeyword, sourceFile)!.getStart(sourceFile);
            const width = getChildOfKind(node.elseStatement.statements[0], ts.SyntaxKind.CloseParenToken, sourceFile)!.getEnd() - start;
            this.addFailure(this.createFailure(start, width, FAIL_MERGE_ELSE_IF));
        }
    }
}

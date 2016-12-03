import * as ts from 'typescript';
import * as Lint from 'tslint';

import { getChildOfKind } from '../src/utils';
import { isBlockLike, isIfStatement, isSwitchStatement } from '../src/typeguard';
import { IfStatementWalker } from '../src/walker';

const FAIL_MESSAGE = `unnecessary else after return`;

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new IfWalker(sourceFile, this.getOptions()));
    }
}

class IfWalker extends IfStatementWalker {
    public visitIfStatement(node: ts.IfStatement) {
        if (node.elseStatement !== undefined && isLastStatementReturn(node.thenStatement)) {
            const sourceFile = this.getSourceFile();
            const elseKeyword = getChildOfKind(node, ts.SyntaxKind.ElseKeyword, sourceFile)!;
            this.addFailure(this.createFailure(elseKeyword.getStart(sourceFile),
                                               4,
                                               FAIL_MESSAGE));
        }
    }
}

function isLastStatementReturn(statement: ts.Statement | ts.BlockLike | ts.DefaultClause): boolean {
    // recurse into nested blocks
    while (isBlockLike(statement)) {
        if (statement.statements.length === 0)
            return false;

        statement = statement.statements[statement.statements.length - 1];
    }

    return isDefinitelyReturned(<ts.Statement>statement);
}

function isDefinitelyReturned(statement: ts.Statement): boolean {
    if (statement.kind === ts.SyntaxKind.ReturnStatement)
        return true;

    if (isIfStatement(statement))
        return statement.elseStatement !== undefined &&
            isLastStatementReturn(statement.thenStatement) &&
            isLastStatementReturn(statement.elseStatement);

    if (isSwitchStatement(statement)) {
        let hasDefault = false;
        let isEmpty = false;
        for (let clause of statement.caseBlock.clauses) {
            isEmpty = clause.statements.length === 0;
            if (!isEmpty && !isLastStatementReturn(clause))
                return false;
            hasDefault = hasDefault || clause.kind === ts.SyntaxKind.DefaultClause;
        }
        return !isEmpty && hasDefault;
    }
    return false;
}

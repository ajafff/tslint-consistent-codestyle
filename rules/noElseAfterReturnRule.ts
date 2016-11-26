import * as ts from 'typescript';
import * as Lint from 'tslint';

import { getKeyword, isBlockLike } from '../src/utils';
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
            const elseKeyword = <ts.KeywordTypeNode> getKeyword(node, ts.SyntaxKind.ElseKeyword, sourceFile);
            this.addFailure(this.createFailure(elseKeyword.getStart(sourceFile),
                                               4,
                                               FAIL_MESSAGE));
        }
    }
}

function isLastStatementReturn(statement: ts.Statement): boolean {
    // recurse into nested blocks
    while (isBlockLike(statement)) {
        if (statement.statements.length === 0)
            return false;

        statement = statement.statements[statement.statements.length - 1];
    }

    return isDefinitelyReturned(statement);
}

function isDefinitelyReturned(statement: ts.Statement): boolean {
    if (statement.kind === ts.SyntaxKind.ReturnStatement)
        return true;

    if (statement.kind === ts.SyntaxKind.IfStatement) {
        const ifStatement = <ts.IfStatement>statement;
        return ifStatement.elseStatement !== undefined &&
            isLastStatementReturn(ifStatement.thenStatement) &&
            isLastStatementReturn(ifStatement.elseStatement);
    }
    // TODO add checks for switch, etc.
    return false;
}

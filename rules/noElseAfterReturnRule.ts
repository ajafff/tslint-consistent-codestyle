import * as ts from 'typescript';
import * as Lint from 'tslint';

import { isBlockLike } from '../src/utils';

const FAIL_MESSAGE = `don't use else after return`;

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new IfWalker(sourceFile, this.getOptions()));
    }
}

class IfWalker extends Lint.RuleWalker {
    public visitIfStatement(node: ts.IfStatement) {
        if (node.elseStatement !== undefined && isLastStatementReturn(node.thenStatement)) {
            const sourceFile = this.getSourceFile();
            const elseKeyword = <ts.KeywordTypeNode> getElseKeyword(node, sourceFile);
            this.addFailure(this.createFailure(elseKeyword.getStart(sourceFile),
                                               4,
                                               FAIL_MESSAGE));
        }
        super.visitIfStatement(node);
    }
}

function isLastStatementReturn(statement: ts.Statement): boolean {
    while (isBlockLike(statement)) {
        // recurse into nested blocks
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

function getElseKeyword(statement: ts.IfStatement, sourceFile?: ts.SourceFile): ts.KeywordTypeNode|undefined {
    const children = statement.getChildren(sourceFile);
    for (let child of children) {
        if (child.kind === ts.SyntaxKind.ElseKeyword)
            return <ts.KeywordTypeNode> child;
    }
}

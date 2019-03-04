import * as ts from 'typescript';
import * as Lint from 'tslint';
import { isBlock, isBlockScopedVariableDeclarationList } from 'tsutils';

export abstract class AbstractReturnStatementWalker<T> extends Lint.AbstractWalker<T> {
    public walk(sourceFile: ts.SourceFile) {
        const cb = (node: ts.Node): void => {
            if (node.kind === ts.SyntaxKind.ReturnStatement)
                this._checkReturnStatement(<ts.ReturnStatement>node);
            return ts.forEachChild(node, cb);
        };
        return ts.forEachChild(sourceFile, cb);
    }

    protected abstract _checkReturnStatement(node: ts.ReturnStatement): void;
}

export abstract class AbstractIfStatementWalker<T> extends Lint.AbstractWalker<T> {
    public walk(sourceFile: ts.SourceFile) {
        const cb = (node: ts.Node): void => {
            if (node.kind === ts.SyntaxKind.IfStatement)
                this._checkIfStatement(<ts.IfStatement>node);
            return ts.forEachChild(node, cb);
        };
        return ts.forEachChild(sourceFile, cb);
    }

    protected _reportUnnecessaryElse(elseStatement: ts.Statement, message: string) {
        const elseKeyword = elseStatement.parent!.getChildAt(5 /*else*/, this.sourceFile);
        if (isBlock(elseStatement) && !elseStatement.statements.some(isBlockScopedDeclaration)) {
            // remove else scope if safe: keep blocks where local variables change scope when unwrapped
            this.addFailureAtNode(elseKeyword, message, [
                Lint.Replacement.deleteFromTo(elseKeyword.end - 4, elseStatement.statements.pos), // removes `else {`
                Lint.Replacement.deleteText(elseStatement.end - 1, 1), // removes `}`
            ]);
        } else {
            // remove else only
            this.addFailureAtNode(elseKeyword, message, Lint.Replacement.deleteText(elseKeyword.end - 4, 4));
        }
    }

    protected abstract _checkIfStatement(node: ts.IfStatement): void;
}

// TODO replace with isBlockScopedDeclarationStatement from tsutils@3.7.0
function isBlockScopedDeclaration(statement: ts.Statement): boolean {
    switch (statement.kind) {
        case ts.SyntaxKind.VariableStatement:
            return isBlockScopedVariableDeclarationList((<ts.VariableStatement>statement).declarationList);
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.EnumDeclaration:
        case ts.SyntaxKind.InterfaceDeclaration:
        case ts.SyntaxKind.TypeAliasDeclaration:
            return true;
        default: return false;
    }
}

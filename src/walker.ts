import * as ts from 'typescript';
import * as Lint from 'tslint';

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

    protected abstract _checkIfStatement(node: ts.IfStatement): void;
}

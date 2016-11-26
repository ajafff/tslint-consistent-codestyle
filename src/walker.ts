import * as ts from 'typescript';
import * as Lint from 'tslint';

export class ReturnStatementWalker extends Lint.RuleWalker {
    public walk(node: ts.Node) {
        const cb = (child: ts.Node) => {
            if (child.kind === ts.SyntaxKind.ReturnStatement)
                this.visitReturnStatement(<ts.ReturnStatement>child);
            ts.forEachChild(child, cb);
        };
        ts.forEachChild(node, cb);
    }
}

export class ConstructorDeclarationWalker extends Lint.RuleWalker {
    public walk(node: ts.Node) {
        const cb = (child: ts.Node) => {
            if (child.kind === ts.SyntaxKind.Constructor)
                this.visitConstructorDeclaration(<ts.ConstructorDeclaration>child);
            ts.forEachChild(child, cb);
        };
        ts.forEachChild(node, cb);
    }
}

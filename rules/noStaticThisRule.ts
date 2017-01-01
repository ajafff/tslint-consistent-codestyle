import { endsThisContext, isScopeBoundary } from '../src/utils';
import * as ts from 'typescript';
import * as Lint from 'tslint';

const FAIL_MESSAGE = `don't use this in static methods`;

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new StaticMethodWalker(sourceFile, this.getOptions()));
    }
}

class StaticMethodWalker extends Lint.RuleWalker {
    private _displayError(node: ts.ThisExpression) {
        this.addFailure(this.createFailure(node.getStart(this.getSourceFile()), 4, FAIL_MESSAGE));
    }

    public walk(node: ts.Node) {
        const stack: boolean[] = [];
        let current = false;
        const cb = (child: ts.Node) => {
            const boundary = isScopeBoundary(child);
            if (boundary) {
                stack.push(current);
                if (!current || endsThisContext(child))
                    current = isStatic(child);
            }
            if (current && child.kind === ts.SyntaxKind.ThisKeyword)
                this._displayError(<ts.ThisExpression>child);
            ts.forEachChild(child, cb);
            if (boundary)
                current = stack.pop()!;
        };
        ts.forEachChild(node, cb);
    }
}

function isStatic(node: ts.Node): boolean {
    return (node.kind === ts.SyntaxKind.MethodDeclaration ||
            node.kind === ts.SyntaxKind.GetAccessor ||
            node.kind === ts.SyntaxKind.SetAccessor) &&
            Lint.hasModifier(node.modifiers, ts.SyntaxKind.StaticKeyword);
}

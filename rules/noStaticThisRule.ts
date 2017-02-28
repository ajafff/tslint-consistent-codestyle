import * as ts from 'typescript';
import * as Lint from 'tslint';
import * as utils from 'tsutils';

const FAIL_MESSAGE = `don't use this in static methods`;

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk);
    }
}

function walk(ctx: Lint.WalkContext<void>) {
    const stack: boolean[] = [];
    let current = false;
    const cb = (child: ts.Node) => {
        const boundary = utils.isScopeBoundary(child);
        if (boundary) {
            stack.push(current);
            if (!current || utils.hasOwnThisReference(child))
                current = isStatic(child);
        }
        if (current && child.kind === ts.SyntaxKind.ThisKeyword)
            ctx.addFailureAtNode(child, FAIL_MESSAGE);
        ts.forEachChild(child, cb);
        if (boundary)
            current = stack.pop()!;
    };
    return ts.forEachChild(ctx.sourceFile, cb);
}

function isStatic(node: ts.Node): boolean {
    return (node.kind === ts.SyntaxKind.MethodDeclaration ||
            node.kind === ts.SyntaxKind.GetAccessor ||
            node.kind === ts.SyntaxKind.SetAccessor) &&
            utils.hasModifier(node.modifiers, ts.SyntaxKind.StaticKeyword);
}

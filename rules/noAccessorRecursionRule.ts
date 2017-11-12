import * as Lint from 'tslint';
import * as ts from 'typescript';
import { isAccessorDeclaration, getPropertyName, hasOwnThisReference, isPropertyAccessExpression } from 'tsutils';

const FAILURE_STRING = 'accessor recursion is not allowed';

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk);
    }
}

function walk(ctx: Lint.WalkContext<void>) {
    let name: string | undefined;

    return ctx.sourceFile.statements.forEach(function cb(node: ts.Node): any {
        if (isAccessorDeclaration(node)) {
            const before = name;
            name = getPropertyName(node.name);
            node.body.statements.forEach(cb);
            name = before;
        } else if (name !== undefined && hasOwnThisReference(node)) {
            const before = name;
            name = undefined;
            ts.forEachChild(node, cb);
            name = before;
        } else if (name !== undefined && isPropertyAccessExpression(node) &&
                   node.expression.kind === ts.SyntaxKind.ThisKeyword && node.name.text === name) {
            ctx.addFailureAtNode(node, FAILURE_STRING);
        } else {
            return ts.forEachChild(node, cb);
        }
    });
}

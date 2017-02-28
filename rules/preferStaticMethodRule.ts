import * as ts from 'typescript';
import * as Lint from 'tslint';
import * as utils from 'tsutils';

const FAIL_MESSAGE = `method can be static or function`;

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk);
    }
}

function walk(ctx: Lint.WalkContext<void>) {
    interface IStackEntry {
        relevant: boolean;
        methodName: string|undefined;
        canBeStatic: boolean;
    };
    const stack: IStackEntry[] = [];
    let relevant = false;
    let canBeStatic = false;
    let methodName: string|undefined = undefined;
    const cb = (node: ts.Node) => {
        const boundary = utils.isScopeBoundary(node);
        if (boundary) {
            stack.push({relevant, canBeStatic, methodName});
            if (!relevant || utils.hasOwnThisReference(node)) {
                relevant = isRelevant(node);
                if (relevant) {
                    canBeStatic = true;
                    methodName = utils.getPropertyName((<ts.MethodDeclaration>node).name);
                }
            }
        }
        if (relevant &&
            (node.kind === ts.SyntaxKind.ThisKeyword && !isRecursion(node, methodName) || node.kind === ts.SyntaxKind.SuperKeyword))
            canBeStatic = false;
        ts.forEachChild(node, cb);
        if (boundary) {
            if (!relevant) {
                ({relevant, canBeStatic, methodName} = stack.pop()!);
            } else {
                const s = canBeStatic;
                ({relevant, canBeStatic, methodName} = stack.pop()!);
                if (relevant) {
                    canBeStatic = canBeStatic && s;
                } else if (s) {
                    // we are about to leave the MethodDeclaration
                    ctx.addFailure(node.getStart(ctx.sourceFile), (<ts.MethodDeclaration>node).name.end, FAIL_MESSAGE);
                }
            }
        }
    };
    return ts.forEachChild(ctx.sourceFile, cb);
}

function isRelevant(node: ts.Node): boolean {
    return node.kind === ts.SyntaxKind.MethodDeclaration &&
           !utils.hasModifier(node.modifiers, ts.SyntaxKind.StaticKeyword, ts.SyntaxKind.AbstractKeyword);
}

function isRecursion(node: ts.Node, methodName: string|undefined) {
    if (methodName === undefined)
        return false;
    const parent = node.parent!;
    // TODO handle ElementAccessExpression
    return utils.isPropertyAccessExpression(parent) &&
        parent.name.text === methodName &&
        parent.parent!.kind === ts.SyntaxKind.CallExpression;
}

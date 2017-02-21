import * as ts from 'typescript';
import * as Lint from 'tslint';
import * as utils from 'tsutils';

import { endsThisContext } from '../src/utils';

const FAIL_MESSAGE = `method can be static or function`;

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new MethodWalker(sourceFile, this.getOptions()));
    }
}

class MethodWalker extends Lint.RuleWalker {
    private _reportError(node: ts.MethodDeclaration) {
        const start = node.getStart(this.getSourceFile());
        const end = node.name.getEnd();
        this.addFailureFromStartToEnd(start, end, FAIL_MESSAGE);
    }

    public walk(node: ts.Node) {
        interface IStackEntry {
            relevant: boolean;
            methodName: string|undefined;
            canBeStatic: boolean;
        };
        const stack: IStackEntry[] = [];
        let relevant = false;
        let canBeStatic = false;
        let methodName: string|undefined = undefined;
        const cb = (child: ts.Node) => {
            const boundary = utils.isScopeBoundary(child);
            if (boundary) {
                stack.push({relevant, canBeStatic, methodName});
                if (!relevant || endsThisContext(child)) {
                    relevant = isRelevant(child);
                    if (relevant) {
                        canBeStatic = true;
                        methodName = utils.getPropertyName((<ts.MethodDeclaration>child).name);
                    }
                }
            }
            if (relevant &&
                (child.kind === ts.SyntaxKind.ThisKeyword && !isRecursion(child, methodName) || child.kind === ts.SyntaxKind.SuperKeyword))
                canBeStatic = false;
            ts.forEachChild(child, cb);
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
                        this._reportError(<ts.MethodDeclaration>child);
                    }
                }
            }
        };
        ts.forEachChild(node, cb);
    }
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

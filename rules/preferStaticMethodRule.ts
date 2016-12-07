import { endsThisContext, isScopeBoundary } from '../src/utils';
import * as ts from 'typescript';
import * as Lint from 'tslint';

const FAIL_MESSAGE = `method can be static or function`;

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new MethodWalker(sourceFile, this.getOptions()));
    }
}

class MethodWalker extends Lint.RuleWalker {
    private _reportError(node: ts.MethodDeclaration) {
        const sourceFile = this.getSourceFile();
        const start = node.getStart(sourceFile);
        const width = node.name.getEnd() - start;
        this.addFailure(this.createFailure(start, width, FAIL_MESSAGE));
    }

    public walk(node: ts.Node) {
        interface IStackEntry {
            relevant: boolean;
            canBeStatic: boolean;
        };
        const stack: IStackEntry[] = [];
        let relevant = false;
        let canBeStatic = false;
        const cb = (child: ts.Node) => {
            let boundary = isScopeBoundary(child);
            if (boundary) {
                stack.push({relevant, canBeStatic});
                if (!relevant || endsThisContext(child)) {
                    relevant = isRelevant(child);
                    canBeStatic = true;
                }
            }
            if (relevant && (child.kind === ts.SyntaxKind.ThisKeyword || child.kind === ts.SyntaxKind.SuperKeyword))
                canBeStatic = false;
            ts.forEachChild(child, cb);
            if (boundary) {
                if (!relevant) {
                    ({relevant, canBeStatic} = stack.pop()!);
                } else {
                    const s = canBeStatic;
                    ({relevant, canBeStatic} = stack.pop()!);
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
           !Lint.hasModifier(node.modifiers, ts.SyntaxKind.StaticKeyword, ts.SyntaxKind.AbstractKeyword);
}

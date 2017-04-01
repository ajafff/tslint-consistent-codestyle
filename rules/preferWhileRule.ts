import * as ts from 'typescript';
import * as Lint from 'tslint';
import * as utils from 'tsutils';

const FAIL_MESSAGE = `use while loop instead`;

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new ForWalker(sourceFile, this.ruleName, undefined));
    }
}

class ForWalker extends Lint.AbstractWalker<void> {
    public walk(sourceFile: ts.SourceFile) {
        const cb = (node: ts.Node): void => {
            if (node.kind === ts.SyntaxKind.ForStatement)
                this._checkForStatement(<ts.ForStatement>node);
            return ts.forEachChild(node, cb);
        };
        return ts.forEachChild(sourceFile, cb);
    }
    private _checkForStatement(node: ts.ForStatement) {
        if (node.initializer === undefined && node.incrementor === undefined) {
            const start = node.getStart(this.sourceFile);
            const closeParenEnd = utils.getChildOfKind(node, ts.SyntaxKind.CloseParenToken, this.sourceFile)!.end;
            let fix: Lint.Fix;
            if (node.condition === undefined) {
                fix = new Lint.Replacement(start, closeParenEnd - start, 'while (true)');
            } else {
                fix = [
                    new Lint.Replacement(start, node.condition.getStart(this.sourceFile) - start, 'while ('),
                    Lint.Replacement.deleteFromTo(node.condition.end, closeParenEnd - 1),
                ];
            }

            this.addFailure(start, closeParenEnd, FAIL_MESSAGE, fix);
        }
    }
}

import * as ts from 'typescript';
import * as Lint from 'tslint';

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
            const closeParenEnd = node.statement.pos;
            let fix: Lint.Fix;
            if (node.condition === undefined) {
                fix = Lint.Replacement.replaceFromTo(start, closeParenEnd, 'while (true)');
            } else {
                fix = [
                    Lint.Replacement.replaceFromTo(start, node.condition.getStart(this.sourceFile), 'while ('),
                    Lint.Replacement.deleteFromTo(node.condition.end, closeParenEnd - 1),
                ];
            }

            this.addFailure(start, closeParenEnd, FAIL_MESSAGE, fix);
        }
    }
}

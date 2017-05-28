import * as ts from 'typescript';
import * as Lint from 'tslint';
import * as utils from 'tsutils';

const FAIL_MESSAGE = 'use <Type> instead of `as Type`';

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new AsExpressionWalker(sourceFile, this.ruleName, undefined));
    }
}

export class AsExpressionWalker extends Lint.AbstractWalker<void> {
    public walk(sourceFile: ts.SourceFile) {
        const cb = (node: ts.Node): void => {
            if (node.kind === ts.SyntaxKind.AsExpression)
                this._reportError(<ts.AsExpression>node);
            return ts.forEachChild(node, cb);
        };
        return ts.forEachChild(sourceFile, cb);
    }

    private _reportError(node: ts.AsExpression) {
        this.addFailure(node.type.pos - 2, node.end, FAIL_MESSAGE, [
            Lint.Replacement.appendText(getInsertionPosition(node, this.sourceFile), `<${node.type.getText(this.sourceFile)}>`),
            Lint.Replacement.deleteFromTo(node.expression.end, node.end),
        ]);
    }

}

function getInsertionPosition(node: ts.AsExpression, sourceFile: ts.SourceFile): number {
        let expression = node.expression;
        while (utils.isAssertionExpression(expression))
            expression = expression.expression;
        return expression.getStart(sourceFile);
}

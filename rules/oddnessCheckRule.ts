import * as ts from 'typescript';
import * as Lint from 'tslint';
import * as utils from 'tsutils';

const FAILURE_STRING = 'Modulus 2 can be replaced with & 1';

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new ReturnWalker(sourceFile, this.getOptions()));
    }
}

class ReturnWalker extends Lint.RuleWalker {
    public walk(sourceFile: ts.SourceFile) {
        const cb = (node: ts.Node): void => {
            if (utils.isBinaryExpression(node) &&
                node.operatorToken.kind === ts.SyntaxKind.PercentToken &&
                utils.isNumericliteral(node.right) &&
                node.right.text === '2') {
                // TODO if this is part of a comparison with a negative value, this failure would be a false positive
                const start = node.operatorToken.getStart(sourceFile);
                const fix = this.createFix(
                    new Lint.Replacement(start, 1, '&'),
                    new Lint.Replacement(node.right.end - 1, 1, '1'),
                );
                this.addFailureFromStartToEnd(start, node.right.end, FAILURE_STRING, fix);
            }
            ts.forEachChild(node, cb);
        };
        ts.forEachChild(sourceFile, cb);
    }
}

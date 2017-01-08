import * as ts from 'typescript';
import * as Lint from 'tslint';

import { ForStatementWalker } from '../src/walker';

const FAIL_MESSAGE = `use while loop instead`;

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new ForWalker(sourceFile, this.getOptions()));
    }
}

class ForWalker extends ForStatementWalker {
    public visitForStatement(node: ts.ForStatement) {
        if (node.initializer === undefined && node.incrementor === undefined) {
            const sourceFile = this.getSourceFile();
            const start = node.getStart(sourceFile);
            const closeParenEnd = Lint.childOfKind(node, ts.SyntaxKind.CloseParenToken)!.getEnd();
            const width = closeParenEnd - start;
            let fix: Lint.Fix;
            if (node.condition === undefined) {
                fix = this.createFix(new Lint.Replacement(start, width, 'while (true)'));
            } else {
                const conditionEnd = node.condition.getEnd();
                fix = this.createFix(
                    new Lint.Replacement(start,
                                         node.condition.getStart(sourceFile) - start,
                                         'while ('),
                    new Lint.Replacement(conditionEnd,
                                         closeParenEnd - conditionEnd - 1,
                                         ''),
                );
            }

            this.addFailure(this.createFailure(start, width, FAIL_MESSAGE, fix));
        }
    }
}

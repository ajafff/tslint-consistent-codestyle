import * as ts from 'typescript';
import * as Lint from 'tslint';
import * as utils from 'tsutils';
import { IfStatementWalker } from '../src/walker';
import { isElseIf } from '../src/utils';

const FAIL_MESSAGE = `unnecessary else`;

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new IfWalker(sourceFile, this.getOptions()));
    }
}

class IfWalker extends IfStatementWalker {
    public visitIfStatement(node: ts.IfStatement) {
        if (node.elseStatement !== undefined &&
            !isElseIf(node) &&
            utils.endsControlFlow(node.thenStatement))
            this.addFailureAtNode(utils.getChildOfKind(node, ts.SyntaxKind.ElseKeyword, this.getSourceFile())!, FAIL_MESSAGE);
    }
}

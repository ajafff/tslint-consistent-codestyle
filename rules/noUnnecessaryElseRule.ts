import * as ts from 'typescript';
import * as Lint from 'tslint';
import { AbstractIfStatementWalker } from '../src/walker';
import { isElseIf } from '../src/utils';
import { endsControlFlow } from 'tsutils';

const FAIL_MESSAGE = `unnecessary else`;

export class Rule extends Lint.Rules.AbstractRule {
  public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    return this.applyWithWalker(new IfWalker(sourceFile, this.ruleName, undefined));
  }
}

class IfWalker extends AbstractIfStatementWalker<void> {
  protected _checkIfStatement(node: ts.IfStatement): void {
    const {elseStatement} = node;
    if (elseStatement !== undefined && !isElseIf(node) && endsControlFlow(node.thenStatement))
        this._reportUnnecessaryElse(elseStatement, FAIL_MESSAGE);
  }
}

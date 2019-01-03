import * as ts from 'typescript';
import * as Lint from 'tslint';
import * as utils from 'tsutils';
import { AbstractIfStatementWalker } from '../src/walker';
import { isElseIf } from '../src/utils';

const FAIL_MESSAGE = `unnecessary else`;
const FAIL_MESSAGE_BLOCK = `unnecessary else block`;

export class Rule extends Lint.Rules.AbstractRule {
  public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    return this.applyWithWalker(new IfWalker(sourceFile, this.ruleName, undefined));
  }
}

class IfWalker extends AbstractIfStatementWalker<void> {
  protected _checkIfStatement(node: ts.IfStatement): void {
    if (isElseIf(node))
      return;

    const elseStatement = node.elseStatement;
    if (isElseStatement(elseStatement) && utils.endsControlFlow(node.thenStatement)) {
      if (elseStatement !== undefined && utils.isBlock(elseStatement) && !hasLocals(elseStatement)) {
        // remove else scope if safe: keep blocks where local variables change scope when unwrapped
        const fixBlock = [
          Lint.Replacement.deleteFromTo(node.thenStatement.end, elseStatement.statements.pos), // removes `else {`
          Lint.Replacement.deleteText(elseStatement.end - 1, 1), // deletes `}`
        ];
        this.addFailureAtNode(node.getChildAt(5 /*else*/, this.sourceFile), FAIL_MESSAGE_BLOCK, fixBlock);
      } else {
        // remove else only
        const fixElse = Lint.Replacement.deleteFromTo(node.thenStatement.getEnd(), elseStatement.getStart());
        this.addFailureAtNode(node.getChildAt(5 /*else*/, this.sourceFile), FAIL_MESSAGE, fixElse);
      }
    }
  }
}

function isElseStatement(node: ts.Statement | undefined): node is ts.Statement {
  return node !== undefined;
}

function hasLocals(node: ts.Block): boolean {
  for (const statement of node.statements) {
    switch (statement.kind) {
      case ts.SyntaxKind.VariableStatement:
        if (utils.isBlockScopedVariableDeclarationList((<ts.VariableStatement>statement).declarationList))
          return true;
        break;

      case ts.SyntaxKind.ClassDeclaration:
      case ts.SyntaxKind.EnumDeclaration:
      case ts.SyntaxKind.InterfaceDeclaration:
      case ts.SyntaxKind.TypeAliasDeclaration:
        return true;
    }
  }

  return false;
}

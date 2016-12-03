import * as ts from 'typescript';
import * as Lint from 'tslint';

import { getChildOfKind } from '../src/utils';
import { isBlockLike, isIfStatement, isSwitchStatement } from '../src/typeguard';
import { IfStatementWalker } from '../src/walker';

const FAIL_MESSAGE = `unnecessary else`;

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new IfWalker(sourceFile, this.getOptions()));
    }
}

class IfWalker extends IfStatementWalker {
    public visitIfStatement(node: ts.IfStatement) {
        if (node.elseStatement !== undefined && endsControlFlow(node.thenStatement)) {
            const sourceFile = this.getSourceFile();
            const elseKeyword = getChildOfKind(node, ts.SyntaxKind.ElseKeyword, sourceFile)!;
            this.addFailure(this.createFailure(elseKeyword.getStart(sourceFile),
                                               4,
                                               FAIL_MESSAGE));
        }
    }
}

function endsControlFlow(statement: ts.Statement|ts.BlockLike|ts.DefaultClause, isSwitch: boolean = false): boolean {
    // recurse into nested blocks
    while (isBlockLike(statement)) {
        if (statement.statements.length === 0)
            return false;

        statement = statement.statements[statement.statements.length - 1];
    }

    return hasReturnBreakContinue(<ts.Statement>statement, isSwitch);
}

function hasReturnBreakContinue(statement: ts.Statement, isSwitch: boolean): boolean {
    if (statement.kind === ts.SyntaxKind.ReturnStatement ||
        statement.kind === ts.SyntaxKind.ContinueStatement ||
        !isSwitch && statement.kind === ts.SyntaxKind.BreakStatement)
        return true;

    if (isIfStatement(statement))
        return statement.elseStatement !== undefined &&
            endsControlFlow(statement.thenStatement, isSwitch) &&
            endsControlFlow(statement.elseStatement, isSwitch);

    if (isSwitchStatement(statement)) {
        let hasDefault = false;
        let isEmpty = false;
        for (let clause of statement.caseBlock.clauses) {
            isEmpty = clause.statements.length === 0;
            if (!isEmpty && !endsControlFlow(clause, true))
                return false;
            hasDefault = hasDefault || clause.kind === ts.SyntaxKind.DefaultClause;
        }
        return !isEmpty && hasDefault;
    }
    return false;
}

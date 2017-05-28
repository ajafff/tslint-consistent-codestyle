import * as ts from 'typescript';
import * as Lint from 'tslint';
import * as utils from 'tsutils';

import { isElseIf } from '../src/utils';
import { AbstractIfStatementWalker } from '../src/walker';

const FAIL_MESSAGE = `unnecessary else after return`;

// TODO respect break label in switch

const enum StatementType {
    None,
    Break,
    Return,
}

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new IfWalker(sourceFile, this.ruleName, undefined));
    }
}

class IfWalker extends AbstractIfStatementWalker<void> {
    protected _checkIfStatement(node: ts.IfStatement) {
        if (node.elseStatement !== undefined &&
            !isElseIf(node) &&
            isLastStatementReturn(node.thenStatement))
            this.addFailureAtNode(node.getChildAt(5 /*else*/, this.sourceFile)!, FAIL_MESSAGE);
    }
}

function isLastStatementReturn(statement: ts.Statement | ts.BlockLike | ts.DefaultClause): boolean {
    return endsControlFlow(statement) === StatementType.Return;
}

function endsControlFlow(statement: ts.Statement|ts.BlockLike|ts.DefaultClause): StatementType {
    // recurse into nested blocks
    while (utils.isBlockLike(statement)) {
        if (statement.statements.length === 0)
            return StatementType.None;

        statement = statement.statements[statement.statements.length - 1];
    }

    return isDefinitelyReturned(<ts.Statement>statement);
}

function isDefinitelyReturned(statement: ts.Statement): StatementType {
    if (statement.kind === ts.SyntaxKind.ReturnStatement)
        return StatementType.Return;
    if (statement.kind === ts.SyntaxKind.BreakStatement)
        return StatementType.Break;

    if (utils.isIfStatement(statement)) {
        if (statement.elseStatement === undefined)
            return StatementType.None;
        const then = endsControlFlow(statement.thenStatement);
        if (!then)
            return then;
        return Math.min(
            then,
            endsControlFlow(statement.elseStatement),
        );
    }

    if (utils.isSwitchStatement(statement)) {
        let hasDefault = false;
        let fallthrough = false;
        for (const clause of statement.caseBlock.clauses) {
            const retVal = endsControlFlow(clause);
            if (retVal === StatementType.None) {
                fallthrough = true;
            } else if (retVal === StatementType.Break) {
                return StatementType.None;
            } else {
                fallthrough = false;
            }
            hasDefault = hasDefault || clause.kind === ts.SyntaxKind.DefaultClause;
        }
        return !fallthrough && hasDefault ? StatementType.Return : StatementType.None;
    }
    return StatementType.None;
}

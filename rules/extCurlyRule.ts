import * as ts from 'typescript';
import * as Lint from 'tslint';
import { isBlock, isIterationStatement, isIfStatement, getNextToken, isSameLine, isLabeledStatement } from 'tsutils';
import { isElseIf } from '../src/utils';

const FAIL_MESSAGE_MISSING = `statement must be braced`;
const FAIL_MESSAGE_UNNECESSARY = `unnecessary curly braces`;

const OPTION_ELSE = 'else';
const OPTION_CONSISTENT = 'consistent';
const OPTION_BRACED_CHILD = 'braced-child';
const OPTION_NESTED_IF_ELSE = 'nested-if-else';

interface IOptions {
    else: boolean;
    consistent: boolean;
    child: boolean;
    nestedIfElse: boolean;
}

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new ExtCurlyWalker(sourceFile, this.ruleName, {
            else: this.ruleArguments.indexOf(OPTION_ELSE) !== -1,
            consistent: this.ruleArguments.indexOf(OPTION_CONSISTENT) !== -1,
            child: this.ruleArguments.indexOf(OPTION_BRACED_CHILD) !== -1,
            nestedIfElse: this.ruleArguments.indexOf(OPTION_NESTED_IF_ELSE) !== -1,
        }));
    }
}

class ExtCurlyWalker extends Lint.AbstractWalker<IOptions> {
    public walk(sourceFile: ts.SourceFile) {
        const cb = (node: ts.Node): void => {
            if (isIterationStatement(node)) {
                this._checkLoop(node);
            } else if (isIfStatement(node)) {
                this._checkIfStatement(node);
            }
            return ts.forEachChild(node, cb);
        };
        return ts.forEachChild(sourceFile, cb);
    }

    private _checkLoop(node: ts.IterationStatement) {
        if (this._needsBraces(node.statement)) {
            if (node.statement.kind !== ts.SyntaxKind.Block)
                this.addFailureAtNode(node.statement, FAIL_MESSAGE_MISSING);
        } else if (node.statement.kind === ts.SyntaxKind.Block) {
            this._reportUnnecessary(<ts.Block>node.statement);
        }
    }

    private _checkIfStatement(node: ts.IfStatement) {
        const [then, otherwise] = this._ifStatementNeedsBraces(node);
        if (then) {
            if (node.thenStatement.kind !== ts.SyntaxKind.Block)
                this.addFailureAtNode(node.thenStatement, FAIL_MESSAGE_MISSING);
        } else if (node.thenStatement.kind === ts.SyntaxKind.Block) {
            this._reportUnnecessary(<ts.Block>node.thenStatement);
        }
        if (otherwise) {
            if (node.elseStatement !== undefined &&
                node.elseStatement.kind !== ts.SyntaxKind.Block && node.elseStatement.kind !== ts.SyntaxKind.IfStatement)
                this.addFailureAtNode(node.elseStatement, FAIL_MESSAGE_MISSING);
        } else if (node.elseStatement !== undefined && node.elseStatement.kind === ts.SyntaxKind.Block) {
            this._reportUnnecessary(<ts.Block>node.elseStatement);
        }
    }

    private _needsBraces(node: ts.Statement, allowIfElse?: boolean): boolean {
        if (isBlock(node))
            return node.statements.length !== 1 || this._needsBraces(node.statements[0], allowIfElse);
        if (!allowIfElse && this.options.nestedIfElse && isIfStatement(node) && node.elseStatement !== undefined)
            return true;
        if (!this.options.child)
            return false;
        if (isIfStatement(node)) {
            const result = this._ifStatementNeedsBraces(node);
            return result[0] || result[1];
        }
        if (isIterationStatement(node) || isLabeledStatement(node))
            return this._needsBraces(node.statement);
        return node.kind === ts.SyntaxKind.SwitchStatement || node.kind === ts.SyntaxKind.TryStatement;
    }

    private _ifStatementNeedsBraces(node: ts.IfStatement, excludeElse?: boolean): [boolean, boolean] {
        if (this.options.else) {
            if (node.elseStatement !== undefined || isElseIf(node))
                return [true, true];
        } else if (this.options.consistent) {
            if (this._needsBraces(node.thenStatement) ||
                !excludeElse && node.elseStatement !== undefined &&
                (isIfStatement(node.elseStatement)
                 ? this._ifStatementNeedsBraces(node.elseStatement)[0]
                 : this._needsBraces(node.elseStatement, true)))
                return [true, true];
            if (isElseIf(node) && this._ifStatementNeedsBraces(node.parent, true)[0])
                return [true, true];
        }
        if (node.elseStatement !== undefined) {
            const statement = unwrapBlock(node.thenStatement);
            return [
                isIfStatement(statement) && statement.elseStatement === undefined || this._needsBraces(statement),
                !excludeElse && this._needsBraces(node.elseStatement, true),
            ];
        }
        return [this._needsBraces(node.thenStatement), false];
    }

    private _reportUnnecessary(block: ts.Block) {
        const closeBrace = block.getChildAt(2, this.sourceFile);
        const nextTokenStart = getNextToken(closeBrace, this.sourceFile)!.getStart(this.sourceFile);
        const closeFix = isSameLine(this.sourceFile, closeBrace.end, nextTokenStart)
            ? Lint.Replacement.deleteFromTo(closeBrace.end - 1, nextTokenStart)
            : Lint.Replacement.deleteFromTo(block.statements.end, block.end);
        this.addFailure(block.statements.pos - 1, block.end, FAIL_MESSAGE_UNNECESSARY, [
            Lint.Replacement.deleteFromTo(block.pos, block.statements.pos),
            closeFix,
        ]);
    }
}

function unwrapBlock(node: ts.Statement): ts.Statement {
    while (isBlock(node) && node.statements.length === 1)
        node = node.statements[0];
    return node;
}

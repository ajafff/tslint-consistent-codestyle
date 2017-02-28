import * as ts from 'typescript';
import * as Lint from 'tslint';
import * as utils from 'tsutils';

import {isUndefined} from '../src/utils';
import {AbstractReturnStatementWalker} from '../src/walker';

const FAIL_MESSAGE = `don't return explicit undefined`;
const ALLOW_VOID_EXPRESSION_OPTION = 'allow-void-expression';

interface IOptions {
    allowVoid: boolean;
}

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new ReturnWalker(sourceFile, this.ruleName, {
            allowVoid: this.ruleArguments.indexOf(ALLOW_VOID_EXPRESSION_OPTION) !== -1,
        }));
    }
}

class ReturnWalker extends AbstractReturnStatementWalker<IOptions> {
    protected _checkReturnStatement(node: ts.ReturnStatement) {
        if (node.expression !== undefined && this._isUndefined(node.expression))
            this.addFailureAtNode(node.expression, FAIL_MESSAGE);
    }

    private _isUndefined(expression: ts.Expression): boolean {
        return this.options.allowVoid ? isUndefinedNotVoidExpr(expression) : isUndefined(expression);
    }
}

function isUndefinedNotVoidExpr(expression: ts.Expression): boolean {
    if (utils.isIdentifier(expression) && expression.text === 'undefined')
        return true;
    return utils.isVoidExpression(expression) && utils.isLiteralExpression(expression.expression);
}

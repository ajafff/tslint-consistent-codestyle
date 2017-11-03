import * as ts from 'typescript';
import * as Lint from 'tslint';
import {isAsExpression} from 'tsutils';

const FAIL_MESSAGE = 'use <Type> instead of `as Type`';

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk);
    }
}

function walk(ctx: Lint.WalkContext<void>) {
    if (ctx.sourceFile.languageVariant === ts.LanguageVariant.JSX)
        return;
    return ts.forEachChild(ctx.sourceFile, function cb(node): void {
        if (isAsExpression(node)) {
            let {type, expression} = node;
            let replacement = `<${type.getText(ctx.sourceFile)}>`;
            while (isAsExpression(expression)) {
                ({type, expression} = expression);
                replacement += `<${type.getText(ctx.sourceFile)}>`;
            }
            ctx.addFailure(type.pos - 2, node.end, FAIL_MESSAGE, [
                Lint.Replacement.appendText(expression.getStart(ctx.sourceFile), replacement),
                Lint.Replacement.deleteFromTo(expression.end, node.end),
            ]);
            return cb(expression);
        }
        return ts.forEachChild(node, cb);
    });
}

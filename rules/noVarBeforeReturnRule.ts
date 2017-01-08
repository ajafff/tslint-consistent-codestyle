import * as ts from 'typescript';
import * as Lint from 'tslint';

import { forEachDestructuringIdentifier, getPreviousStatement, isUndefined } from '../src/utils';
import { isComputedPropertyName, isIdentifier, isLiteralExpression, isVariableStatement } from '../src/typeguard';
import { ReturnStatementWalker } from '../src/walker';

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new ReturnWalker(sourceFile, this.getOptions()));
    }
}

class ReturnWalker extends ReturnStatementWalker {
    public visitReturnStatement(node: ts.ReturnStatement) {
        if (node.expression !== undefined && isIdentifier(node.expression)) {
            const statement = getPreviousStatement(node);
            if (statement !== undefined && isVariableStatement(statement)) {
                const declarations = statement.declarationList.declarations;
                const lastDeclaration = declarations[declarations.length - 1].name;
                if (isIdentifier(lastDeclaration)) {
                    if (lastDeclaration.text !== node.expression.text)
                        return;
                } else if (!isSimpleDestructuringForName(lastDeclaration, node.expression.text)) {
                    return;
                }
                this.addFailureAtNode(node.expression, `don't declare variable ${node.expression.text} to return it immediately`);
            }
        }
    }
}

function isSimpleDestructuringForName(pattern: ts.BindingPattern, name: string): boolean {
    const identifiersSeen = new Set<string>();
    return forEachDestructuringIdentifier(pattern, (element) => {
        if (element.name.text !== name)
            return void identifiersSeen.add(element.name.text);
        if (element.dotDotDotToken !== undefined ||
            element.initializer !== undefined && !isUndefined(element.initializer))
            return false;

        const property = element.propertyName;
        if (property === undefined)
            return true;

        if (isComputedPropertyName(property)) {
            if (isIdentifier(property.expression))
                return !identifiersSeen.has(property.expression.text);
            if (isLiteralExpression(property.expression))
                return true;
            return false;
        }
        return true;
    }) === true;
}

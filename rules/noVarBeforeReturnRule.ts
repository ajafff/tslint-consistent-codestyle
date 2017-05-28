import * as ts from 'typescript';
import * as Lint from 'tslint';
import * as utils from 'tsutils';

import { isUndefined } from '../src/utils';

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk);
    }
}

function walk(ctx: Lint.WalkContext<void>) {
    return ts.forEachChild(ctx.sourceFile, cbNode, cbNodeArray);

    function cbNode(node: ts.Node): void {
        return ts.forEachChild(node, cbNode, cbNodeArray);
    }

    function cbNodeArray(nodes: ts.Node[]): void {
        if (nodes.length === 0)
            return;
        ts.forEachChild(nodes[0], cbNode, cbNodeArray);
        for (let i = 1; i < nodes.length; ++i) {
            const node = nodes[i];
            if (utils.isReturnStatement(node)) {
                if (node.expression === undefined)
                    continue;
                if (!utils.isIdentifier(node.expression)) {
                    ts.forEachChild(node.expression, cbNode, cbNodeArray);
                    continue;
                }
                const previous = nodes[i - 1];
                if (utils.isVariableStatement(previous) && declaresVariable(previous, node.expression.text))
                    ctx.addFailureAtNode(node.expression, `don't declare variable ${node.expression.text} to return it immediately`);
            } else {
                ts.forEachChild(node, cbNode, cbNodeArray);
            }
        }
    }
}

function declaresVariable(statement: ts.VariableStatement, name: string): boolean {
    const declarations = statement.declarationList.declarations;
    const lastDeclaration = declarations[declarations.length - 1].name;
    if (utils.isIdentifier(lastDeclaration))
        return lastDeclaration.text === name;
    return isSimpleDestructuringForName(lastDeclaration, name);
}

function isSimpleDestructuringForName(pattern: ts.BindingPattern, name: string): boolean {
    const identifiersSeen = new Set<string>();
    interface IResult {
        result: boolean;
    }
    const result = utils.forEachDestructuringIdentifier(pattern, (element): IResult | undefined => {
        if (element.name.text !== name)
            return void identifiersSeen.add(element.name.text);
        if (element.dotDotDotToken !== undefined ||
            element.initializer !== undefined && !isUndefined(element.initializer))
            return {result: false};

        const property = element.propertyName;
        if (property === undefined)
            return {result: true};

        if (utils.isComputedPropertyName(property)) {
            if (utils.isIdentifier(property.expression))
                return {result: !identifiersSeen.has(property.expression.text)};
            if (utils.isLiteralExpression(property.expression))
                return {result: true};
            return {result: false};
        }
        return {result: true};
    });
    return result !== undefined && result.result;
}

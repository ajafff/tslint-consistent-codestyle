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
    let inArray = 0;
    let dependsOnVar = 0;

    return recur(pattern) === true;

    function recur(p: ts.BindingPattern): boolean | undefined {
        if (p.kind === ts.SyntaxKind.ArrayBindingPattern) {
            ++inArray;
            for (const element of p.elements) {
                if (element.kind !== ts.SyntaxKind.OmittedExpression) {
                    const result = handleBindingElement(element);
                    if (result !== undefined)
                        return result;
                }
            }
            --inArray;
        } else {
            for (const element of p.elements) {
                const result = handleBindingElement(element);
                if (result !== undefined)
                    return result;
            }
        }
    }
    function handleBindingElement(element: ts.BindingElement): boolean | undefined {
        if (element.name.kind !== ts.SyntaxKind.Identifier) {
            if (dependsOnPrevious(element)) {
                ++dependsOnVar;
                const result = recur(element.name);
                --dependsOnVar;
                return result;
            }
            return recur(element.name);
        }
        if (element.name.text !== name)
            return void identifiersSeen.add(element.name.text);
        if (dependsOnVar !== 0)
            return false;
        if (element.dotDotDotToken) {
            if (element.parent!.elements.length > 1)
                return false;
            if (inArray > (element.parent!.kind === ts.SyntaxKind.ArrayBindingPattern ? 1 : 0))
                return false;
        } else if (inArray !== 0) {
            return false;
        }
        if (element.initializer !== undefined && !isUndefined(element.initializer))
            return false;
        return !dependsOnPrevious(element);
    }
    function dependsOnPrevious(element: ts.BindingElement): boolean {
        if (element.propertyName === undefined || element.propertyName.kind !== ts.SyntaxKind.ComputedPropertyName)
            return false;
        if (utils.isIdentifier(element.propertyName.expression))
            return identifiersSeen.has(element.propertyName.expression.text);
        if (utils.isLiteralExpression(element.propertyName.expression))
            return false;
        return true; // TODO implement better check for expressions
    }
}

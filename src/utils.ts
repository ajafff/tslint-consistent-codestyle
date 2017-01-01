import {
    isBindingElement,
    isBlockLike,
    isComputedPropertyName,
    isIdentifier,
    isIfStatement,
    isLiteralExpression,
} from './typeguard';
import * as ts from 'typescript';
import * as Lint from 'tslint';

export function isParameterProperty(node: ts.ParameterDeclaration): boolean {
    return Lint.hasModifier(node.modifiers,
                            ts.SyntaxKind.PublicKeyword,
                            ts.SyntaxKind.ProtectedKeyword,
                            ts.SyntaxKind.PrivateKeyword,
                            ts.SyntaxKind.ReadonlyKeyword);
}

export function hasAccessModifier(node: ts.Node): boolean {
    return Lint.hasModifier(node.modifiers,
                            ts.SyntaxKind.PublicKeyword,
                            ts.SyntaxKind.ProtectedKeyword,
                            ts.SyntaxKind.PrivateKeyword);
}

export function isUndefined(expression: ts.Expression): boolean {
    return isIdentifier(expression) && expression.text === 'undefined' ||
        expression.kind === ts.SyntaxKind.VoidExpression;
}

export function getPreviousStatement(statement: ts.Statement): ts.Statement|undefined {
    const parent = statement.parent!;
    if (isBlockLike(parent)) {
        const index = parent.statements.indexOf(statement);
        if (index > 0)
            return parent.statements[index - 1];
    }
}

export function getNextStatement(statement: ts.Statement): ts.Statement|undefined {
    const parent = statement.parent!;
    if (isBlockLike(parent)) {
        const index = parent.statements.indexOf(statement);
        if (index < parent.statements.length)
            return parent.statements[index + 1];
    }
}

export function getChildOfKind(node: ts.Node, kind: ts.SyntaxKind, sourceFile?: ts.SourceFile): ts.Node|undefined {
    const children = node.getChildren(sourceFile);
    for (const child of children) {
        if (child.kind === kind)
            return child;
    }
}

export function getPropertyName(propertyName: ts.PropertyName|ts.LiteralExpression): string|undefined {
    if (isIdentifier(propertyName))
        return propertyName.text;
    if (isComputedPropertyName(propertyName)) {
        if (!isLiteralExpression(propertyName.expression))
            return;
        propertyName = propertyName.expression;
    }
    return propertyName.text;
}

export function isElseIf(node: ts.IfStatement): boolean {
    const parent = node.parent!;
    return isIfStatement(parent) &&
         parent.elseStatement === node;
}

export function endsThisContext(node: ts.Node): boolean {
    return node.kind === ts.SyntaxKind.FunctionDeclaration ||
           node.kind === ts.SyntaxKind.FunctionExpression ||
           node.kind === ts.SyntaxKind.ClassDeclaration ||
           node.kind === ts.SyntaxKind.ClassExpression;
}

export type ForEachDestructuringIdentifierCallback = (element: ts.BindingElement & {name: ts.Identifier}) => boolean|void;

export function forEachDestructuringIdentifier(pattern: ts.BindingPattern, fn: ForEachDestructuringIdentifierCallback): boolean|void {
    for (const element of pattern.elements) {
        if (!isBindingElement(element))
            continue;
        let result: boolean|void;
        if (isIdentifier(element.name)) {
            result = fn(<ts.BindingElement & {name: ts.Identifier}>element);
        } else {
            result = forEachDestructuringIdentifier(element.name, fn);
        }
        if (result !== undefined) {
            return result;
        }
    }
}

export let isScopeBoundary = (class extends Lint.ScopeAwareRuleWalker<void> {
    public createScope() { return this; }
    public static getFn() {
        return this.prototype.isScopeBoundary;
    }
}).getFn();

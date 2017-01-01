import * as ts from 'typescript';

export function isAsExpression(node: ts.Node): node is ts.AsExpression {
    return node.kind === ts.SyntaxKind.AsExpression;
}

export function isBindingElement(node: ts.Node): node is ts.BindingElement {
    return node.kind === ts.SyntaxKind.BindingElement;
}

export function isBlockLike(node: ts.Node): node is ts.BlockLike {
    return 'statements' in node;
}

export function isComputedPropertyName(node: ts.Node): node is ts.ComputedPropertyName {
    return node.kind === ts.SyntaxKind.ComputedPropertyName;
}

export function isElementAccessExpression(node: ts.Node): node is ts.ElementAccessExpression {
    return node.kind === ts.SyntaxKind.ElementAccessExpression;
}

export function isIdentifier(node: ts.Node): node is ts.Identifier {
    return node.kind === ts.SyntaxKind.Identifier;
}

export function isIfStatement(node: ts.Node): node is ts.IfStatement {
    return node.kind === ts.SyntaxKind.IfStatement;
}

export function isLiteralExpression(node: ts.Node): node is ts.LiteralExpression {
    return node.kind >= ts.SyntaxKind.FirstLiteralToken &&
           node.kind <= ts.SyntaxKind.LastLiteralToken;
}

export function isPropertyAccessExpression(node: ts.Node): node is ts.PropertyAccessExpression {
    return node.kind === ts.SyntaxKind.PropertyAccessExpression;
}

export function isStringLiteral(node: ts.Node): node is ts.StringLiteral {
    return node.kind === ts.SyntaxKind.StringLiteral;
}

export function isSwitchStatement(node: ts.Node): node is ts.SwitchStatement {
    return node.kind === ts.SyntaxKind.SwitchStatement;
}

export function isTypeAssertion(node: ts.Node): node is ts.TypeAssertion {
    return node.kind === ts.SyntaxKind.TypeAssertionExpression;
}

export function isVariableStatement(node: ts.Node): node is ts.VariableStatement {
    return node.kind === ts.SyntaxKind.VariableStatement;
}

export function isVoidExpression(node: ts.Node): node is ts.VoidExpression {
    return node.kind === ts.SyntaxKind.VoidExpression;
}

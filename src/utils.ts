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
    return expression.kind === ts.SyntaxKind.Identifier && (<ts.Identifier>expression).text === 'undefined' ||
        expression.kind === ts.SyntaxKind.VoidExpression;
}

export function getPreviousStatement(statement: ts.Statement): ts.Statement|undefined {
    const parent = <ts.BlockLike>statement.parent;
    if (isBlockLike(parent)) {
        const index = parent.statements.indexOf(statement);
        if (index > 0)
            return parent.statements[index - 1];
    }
    return;
}

function isBlockLike(node: ts.Node): node is ts.BlockLike {
    return 'statements' in node;
}

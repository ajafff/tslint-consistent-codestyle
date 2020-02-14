import { isBlock, isThrowStatement, isCaseOrDefaultClause, isIfStatement, isFunctionScopeBoundary } from 'tsutils';
import * as Lint from 'tslint';
import * as ts from 'typescript';

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        const options = {
            'max-length': 2,
            'ignore-constructor': false,
            ...this.ruleArguments[0],
        };
        return this.applyWithFunction(sourceFile, walk, options);
    }
}

function failureString(exit: string): string {
    return `Remainder of block is inside 'if' statement. Prefer to invert the condition and '${exit}' early.`;
}

function failureStringSmall(exit: string, branch: 'else' | 'then'): string {
    return `'${branch}' branch is small; prefer an early '${exit}' to a full if-else.`;
}

function failureStringAlways(exit: string): string {
    return `Prefer an early '${exit}' to a full if-else.`;
}

interface IOptions {
    'max-length': number;
    'ignore-constructor': boolean;
}

function walk(ctx: Lint.WalkContext<IOptions>) {
    const {
        sourceFile,
        options: { 'max-length': maxLineLength, 'ignore-constructor': ignoreConstructor },
    } = ctx;

    return ts.forEachChild(sourceFile, function cb(node): void {
        if (isIfStatement(node) && (!ignoreConstructor || !isConstructorClosestFunctionScopeBoundary(node)))
            check(node);

        return ts.forEachChild(node, cb);
    });

    function check(node: ts.IfStatement): void {
        const exit = getExit(node);
        if (exit === undefined)
            return;

        const { thenStatement, elseStatement } = node;
        const thenSize = size(thenStatement, sourceFile);

        if (elseStatement === undefined) {
            if (isLarge(thenSize) && !isThrow(thenStatement))
                fail(failureString(exit));
            return;
        }

        // Never fail if there's an `else if`.
        if (elseStatement.kind === ts.SyntaxKind.IfStatement)
            return;

        if (maxLineLength === 0)
            return fail(failureStringAlways(exit));

        const elseSize = size(elseStatement, sourceFile);

        if (isSmall(thenSize) && isLarge(elseSize)) {
            fail(failureStringSmall(exit, 'then'));
        } else if (isSmall(elseSize) && isLarge(thenSize)) {
            fail(failureStringSmall(exit, 'else'));
        }

        function fail(failure: string) {
            ctx.addFailureAt(node.getStart(sourceFile), 2, failure);
        }
    }

    function isSmall(length: number): boolean {
        return length === 1;
    }

    function isLarge(length: number): boolean {
        return length > maxLineLength;
    }
}

function size(node: ts.Node, sourceFile: ts.SourceFile): number {
    return isBlock(node)
        ? node.statements.length === 0 ? 0 : diff(node.statements[0].getStart(sourceFile), node.statements.end, sourceFile)
        : diff(node.getStart(sourceFile), node.end, sourceFile);
}

function isThrow(node: ts.Node): boolean {
    return isBlock(node)
        ? node.statements.length === 1
            ? isThrowStatement(node.statements[0])
            : false
        : isThrowStatement(node);
}

function diff(start: number, end: number, sourceFile: ts.SourceFile): number {
    return ts.getLineAndCharacterOfPosition(sourceFile, end).line
        - ts.getLineAndCharacterOfPosition(sourceFile, start).line
        + 1;
}

function getExit(node: ts.IfStatement): string | undefined {
    const parent = node.parent!;
    if (isBlock(parent)) {
        const container = parent.parent!;
        return isCaseOrDefaultClause(container) && container.statements.length === 1
            ? getCaseClauseExit(container, parent, node)
            // Must be the last statement in the block
            : isLastStatement(node, parent.statements) ? getEarlyExitKind(container) : undefined;
    }
    return isCaseOrDefaultClause(parent)
        ? getCaseClauseExit(parent, parent, node)
        // This is the only statement in its container, so of course it's the final statement.
        : getEarlyExitKind(parent);
}

function getCaseClauseExit(
    clause: ts.CaseOrDefaultClause,
    { statements }: ts.CaseOrDefaultClause | ts.Block,
    node: ts.IfStatement): string | undefined {
    return statements[statements.length - 1].kind === ts.SyntaxKind.BreakStatement
        // Must be the last node before the break statement
        ? isLastStatement(node, statements, statements.length - 2) ? 'break' : undefined
        // If no 'break' statement, this is a fallthrough, unless we're at the last clause.
        : clause.parent!.clauses[clause.parent!.clauses.length - 1] === clause && isLastStatement(node, statements) ? 'break' : undefined;
}

function getEarlyExitKind({ kind }: ts.Node): string | undefined {
    switch (kind) {
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.ArrowFunction:
        case ts.SyntaxKind.MethodDeclaration:
        case ts.SyntaxKind.Constructor:
        case ts.SyntaxKind.GetAccessor:
        case ts.SyntaxKind.SetAccessor:
            return 'return';

        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
            return 'continue';

        default:
            // At any other location, we can't use an early exit.
            // (TODO: maybe we could, but we would need more control flow information here.)
            // (Cause clauses handled separately.)
            return;
    }
}

function isLastStatement(ifStatement: ts.IfStatement, statements: ReadonlyArray<ts.Statement>, i: number = statements.length - 1): boolean {
    while (true) {
        const statement = statements[i];
        if (statement === ifStatement)
            return true;
        if (statement.kind !== ts.SyntaxKind.FunctionDeclaration)
            return false;
        if (i === 0)
            // ifStatement should have been in statements
            throw new Error();
        i--;
    }
}

function isConstructorClosestFunctionScopeBoundary(node: ts.Node): boolean {
    let currentParent = node.parent;
    while (currentParent) {
        if (isFunctionScopeBoundary(currentParent))
            return currentParent.kind === ts.SyntaxKind.Constructor;
        currentParent = currentParent.parent;
    }
    return false;
}

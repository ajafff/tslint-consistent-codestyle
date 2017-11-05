import * as ts from 'typescript';
import * as Lint from 'tslint';
import {
    isTypeParameter,
    getVariableDeclarationKind,
    VariableDeclarationKind,
    getPropertyName,
    isTypeFlagSet,
    isExpressionValueUsed,
    isUnionType,
} from 'tsutils';

type FunctionExpressionLike = ts.ArrowFunction | ts.FunctionExpression;

const FAIL_MESSAGE = `type annotation is redundant`;

export class Rule extends Lint.Rules.TypedRule {
    public applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk, undefined, program.getTypeChecker());
    }
}

function walk(ctx: Lint.WalkContext<void>, checker: ts.TypeChecker) {
    return ts.forEachChild(ctx.sourceFile, function cb(node): void {
        switch (node.kind) {
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.FunctionExpression:
                checkFunction(<FunctionExpressionLike>node);
                // TODO check return type - add option
                break;
            case ts.SyntaxKind.MethodDeclaration:
                if (node.parent!.kind === ts.SyntaxKind.ObjectLiteralExpression)
                    checkObjectLiteralMethod(<ts.MethodDeclaration>node);
                break;
            case ts.SyntaxKind.VariableDeclarationList:
                // TODO add an option where to put the type annotation for functions (variable or function)
                checkVariables(<ts.VariableDeclarationList>node);
        }
        return ts.forEachChild(node, cb);
    });

    function checkFunction(node: FunctionExpressionLike) {
        // TODO use getContextuallyTypedParameterType
        const iife = getIife(node);
        if (iife !== undefined)
            return checkIife(node, iife);

        const type = getContextualTypeOfFunction(node);
        if (type === undefined)
            return;
        checkContextSensitiveFunctionOrMethod(node, type);
    }

    function checkObjectLiteralMethod(node: ts.MethodDeclaration) {
        const type = getContextualTypeOfObjectLiteralMethod(node);
        if (type === undefined)
            return;
        checkContextSensitiveFunctionOrMethod(node, type);
    }

    function checkContextSensitiveFunctionOrMethod(node: ts.FunctionLikeDeclaration, contextualType: ts.Type) {
        const callSignatures = contextualType.getCallSignatures();
        // TODO choose the correct signature?
        if (callSignatures.length !== 1)
            return;
        const signature = callSignatures[0];
        if (node.type !== undefined && !signatureHasGenericReturn(signature) &&
            typesAreEqual(checker.getTypeFromTypeNode(node.type), signature.getReturnType()))
            fail(node.type);

        if (!node.parameters.some((p) => p.type !== undefined && p.dotDotDotToken === undefined))
            return;

        for (let i = 0; i < node.parameters.length; ++i) {
            const parameter = node.parameters[i];
            if (parameter.dotDotDotToken !== undefined || parameter.type === undefined)
                continue;
            const context = signature.parameters[i];
            if (context === undefined)
                break;
            if (context.declarations !== undefined && isTypeParameter(checker.getTypeAtLocation(context.declarations[0])))
                continue;
            const type = checker.getTypeFromTypeNode(parameter.type);
            const contextualParameterType = checker.getTypeOfSymbolAtLocation(context, node);
            if (typesAreEqual(type, contextualParameterType))
                fail(parameter.type);
        }
    }

    function checkIife(func: FunctionExpressionLike, iife: ts.CallExpression) {
        if (func.type !== undefined && func.name === undefined &&
            (
                !isExpressionValueUsed(iife) ||
                !containsLiteralType(checker.getTypeFromTypeNode(func.type)) && checker.getContextualType(iife) !== undefined
            ))
            fail(func.type);

        const {parameters} = func;
        if (!parameters.some((p) => p.type !== undefined && p.dotDotDotToken === undefined))
            return;

        const args = iife.arguments;
        const len = Math.min(parameters.length, args.length);
        for (let i = 0; i < len; ++i) {
            const {type, dotDotDotToken} = parameters[i];
            if (type === undefined || dotDotDotToken !== undefined)
                continue;
            if (typesAreEqual(checker.getTypeFromTypeNode(type), checker.getBaseTypeOfLiteralType(checker.getTypeAtLocation(args[i]))))
                fail(type);
        }
    }

    function checkVariables(list: ts.VariableDeclarationList) {
        const isConst = getVariableDeclarationKind(list) === VariableDeclarationKind.Const;
        for (const variable of list.declarations) {
            if (variable.type === undefined || variable.initializer === undefined)
                continue;
            let inferred = checker.getTypeAtLocation(variable.initializer);
            if (!isConst)
                inferred = checker.getBaseTypeOfLiteralType(inferred);
            const declared = checker.getTypeFromTypeNode(variable.type);
            if (typesAreEqual(declared, inferred) || isConst && typesAreEqual(declared, checker.getBaseTypeOfLiteralType(inferred)))
                fail(variable.type);
        }
    }

    function fail(type: ts.TypeNode) {
        ctx.addFailure(type.pos - 1, type.end, FAIL_MESSAGE, Lint.Replacement.deleteFromTo(type.pos - 1, type.end));
    }

    // TODO this could use a little more effort
    function typesAreEqual(a: ts.Type, b: ts.Type): boolean {
        return a === b || checker.typeToString(a) === checker.typeToString(b);
    }

    function getContextualTypeOfFunction(func: FunctionExpressionLike): ts.Type | undefined {
        const type = checker.getContextualType(func);
        return type && checker.getApparentType(type);
    }

    function getContextualTypeOfObjectLiteralMethod(method: ts.MethodDeclaration): ts.Type | undefined {
        const name = getPropertyName(method.name);
        if (name === undefined)
            return;
        let type = checker.getTypeAtLocation(method.parent!);
        if (type === undefined)
            return;
        type = checker.getApparentType(type);
        if (!isTypeFlagSet(type, ts.TypeFlags.StructuredType))
            return;
        const symbol = type.getProperty(name);
        return symbol && checker.getTypeOfSymbolAtLocation(symbol, method.name);
    }

    function signatureHasGenericReturn(signature: ts.Signature): boolean {
        const original = checker.getSignatureFromDeclaration(signature.declaration);
        return original !== undefined && isTypeParameter(original.getReturnType());
    }
}

function getIife(node: FunctionExpressionLike): ts.CallExpression | undefined {
    if (node.parent!.kind !== ts.SyntaxKind.ParenthesizedExpression)
        return;
    let prev = node.parent!;
    let parent = prev.parent!;
    while (parent.kind === ts.SyntaxKind.ParenthesizedExpression) {
        prev = parent;
        parent = parent.parent!;
    }
    if (parent.kind === ts.SyntaxKind.CallExpression && (<ts.CallExpression>parent).expression === prev)
        return <ts.CallExpression>parent;
}

function containsLiteralType(type: ts.Type): boolean {
    return isUnionType(type) ? type.types.some(containsLiteralType) : isTypeFlagSet(type, ts.TypeFlags.Literal);
}

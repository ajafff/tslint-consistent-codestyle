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
    isThisParameter,
    isTypePredicateNode,
    isValidNumericLiteral,
    isIntersectionType,
} from 'tsutils';

type FunctionExpressionLike = ts.ArrowFunction | ts.FunctionExpression;

const CHECK_RETURN_TYPE_OPTION = 'check-return-type';
const FAIL_MESSAGE = `type annotation is redundant`;

interface IOptions {
    checkReturnType: boolean;
}

export class Rule extends Lint.Rules.TypedRule {
    public applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
        return this.applyWithFunction(
            sourceFile,
            walk, {
                checkReturnType: this.ruleArguments.indexOf(CHECK_RETURN_TYPE_OPTION) !== -1,
            },
            program.getTypeChecker(),
        );
    }
}

const formatFlags = ts.TypeFormatFlags.UseStructuralFallback
    | ts.TypeFormatFlags.UseFullyQualifiedType
    | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope
    | ts.TypeFormatFlags.NoTruncation
    | ts.TypeFormatFlags.WriteClassExpressionAsTypeLiteral
    | ts.TypeFormatFlags.WriteArrowStyleSignature;

function walk(ctx: Lint.WalkContext<IOptions>, checker: ts.TypeChecker) {
    return ts.forEachChild(ctx.sourceFile, function cb(node): void {
        switch (node.kind) {
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.FunctionExpression:
                checkFunction(<FunctionExpressionLike>node);
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
        if (!functionHasTypeDeclarations(node))
            return;

        const iife = getIife(node);
        if (iife !== undefined)
            return checkIife(node, iife);

        const type = getContextualTypeOfFunction(node);
        if (type === undefined)
            return;
        checkContextSensitiveFunctionOrMethod(node, type);
    }

    function checkObjectLiteralMethod(node: ts.MethodDeclaration) {
        if (!functionHasTypeDeclarations(node))
            return;

        const type = getContextualTypeOfObjectLiteralMethod(node);
        if (type === undefined)
            return;
        checkContextSensitiveFunctionOrMethod(node, type);
    }

    function checkContextSensitiveFunctionOrMethod(node: ts.FunctionLikeDeclaration, contextualType: ts.Type) {
        const parameters = parametersExceptThis(node.parameters);
        const sig = getMatchingSignature(contextualType, parameters);
        if (sig === undefined)
            return;
        const [signature, checkReturn] = sig;

        if (ctx.options.checkReturnType && checkReturn && node.type !== undefined && !signatureHasGenericOrTypePredicateReturn(signature) &&
            typesAreEqual(checker.getTypeFromTypeNode(node.type), signature.getReturnType()))
            fail(node.type);

        let restParameterContext = false;
        let contextualParameterType: ts.Type;

        for (let i = 0; i < parameters.length; ++i) {
            if (!restParameterContext) {
                const context = signature.parameters[i];
                // wotan-disable-next-line no-useless-predicate
                if (context === undefined || context.valueDeclaration === undefined)
                    break;
                if (isTypeParameter(checker.getTypeAtLocation(context.valueDeclaration)))
                    continue;
                contextualParameterType = checker.getTypeOfSymbolAtLocation(context, node);
                if ((<ts.ParameterDeclaration>context.valueDeclaration).dotDotDotToken !== undefined) {
                    const indexType = contextualParameterType.getNumberIndexType();
                    if (indexType === undefined)
                        break;
                    contextualParameterType = indexType;
                    restParameterContext = true;
                }
            }
            const parameter = parameters[i];
            if (parameter.type === undefined)
                continue;
            let declaredType: ts.Type;
            if (parameter.dotDotDotToken !== undefined) {
                if (!restParameterContext)
                    break;
                declaredType = checker.getTypeFromTypeNode(parameter.type);
                const indexType = declaredType.getNumberIndexType();
                if (indexType === undefined)
                    break;
                declaredType = indexType;
            } else {
                declaredType = checker.getTypeFromTypeNode(parameter.type);
            }
            if (compareParameterTypes(
                contextualParameterType!,
                declaredType,
                parameter.questionToken !== undefined || parameter.initializer !== undefined,
            ))
                fail(parameter.type);
        }
    }

    function checkIife(func: FunctionExpressionLike, iife: ts.CallExpression) {
        if (ctx.options.checkReturnType && func.type !== undefined && func.name === undefined &&
            (
                !isExpressionValueUsed(iife) ||
                !containsTypeWithFlag(checker.getTypeFromTypeNode(func.type), ts.TypeFlags.Literal) &&
                checker.getContextualType(iife) !== undefined
            ))
            fail(func.type);

        const parameters = parametersExceptThis(func.parameters);

        const args = iife.arguments;
        const len = Math.min(parameters.length, args.length);
        outer: for (let i = 0; i < len; ++i) {
            const parameter = parameters[i];
            if (parameter.type === undefined)
                continue;
            const declaredType = checker.getTypeFromTypeNode(parameter.type);
            const contextualType = checker.getBaseTypeOfLiteralType(checker.getTypeAtLocation(args[i]));
            if (parameter.dotDotDotToken !== undefined) {
                const indexType = declaredType.getNumberIndexType();
                if (indexType === undefined || !typesAreEqual(indexType, contextualType))
                    break;
                for (let j = i + 1; j < args.length; ++j)
                    if (!typesAreEqual(contextualType, checker.getBaseTypeOfLiteralType(checker.getTypeAtLocation(args[j]))))
                        break outer; // TODO build UnionType
                fail(parameter.type);
            } else if (compareParameterTypes(
                contextualType,
                declaredType,
                parameter.questionToken !== undefined || parameter.initializer !== undefined,
            )) {
                fail(parameter.type);
            }
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
        return a === b || checker.typeToString(a, undefined, formatFlags) === checker.typeToString(b, undefined, formatFlags);
    }

    function getContextualTypeOfFunction(func: FunctionExpressionLike): ts.Type | undefined {
        const type = checker.getContextualType(func);
        return type && checker.getApparentType(type);
    }

    function getContextualTypeOfObjectLiteralMethod(method: ts.MethodDeclaration): ts.Type | undefined {
        let type = checker.getContextualType(<ts.ObjectLiteralExpression>method.parent);
        if (type === undefined)
            return;
        type = checker.getApparentType(type);
        if (!isTypeFlagSet(type, ts.TypeFlags.StructuredType))
            return;
        const t = checker.getTypeAtLocation(method);
        const symbol = t.symbol && type.getProperties().find((s) => s.escapedName === t.symbol!.escapedName);
        return symbol !== undefined
            ? checker.getTypeOfSymbolAtLocation(symbol, method.name)
            : isNumericPropertyName(method.name) && type.getNumberIndexType() || type.getStringIndexType();
    }

    function signatureHasGenericOrTypePredicateReturn(signature: ts.Signature): boolean {
        if (signature.declaration.type !== undefined && isTypePredicateNode(signature.declaration.type))
            return true;
        const original = checker.getSignatureFromDeclaration(signature.declaration);
        return original !== undefined && isTypeParameter(original.getReturnType());
    }

    function removeOptionalityFromType(type: ts.Type): ts.Type {
        if (!containsTypeWithFlag(type, ts.TypeFlags.Undefined))
            return type;
        const allowsNull = containsTypeWithFlag(type, ts.TypeFlags.Null);
        type = checker.getNonNullableType(type);
        return allowsNull ? checker.getNullableType(type, ts.TypeFlags.Null) : type;
    }

    function compareParameterTypes(context: ts.Type, declared: ts.Type, optional: boolean): boolean {
        if (optional)
            declared = removeOptionalityFromType(declared);
        return typesAreEqual(declared, context) ||
            optional && typesAreEqual(checker.getNullableType(declared, ts.TypeFlags.Undefined), context);
    }

    function isNumericPropertyName(name: ts.PropertyName) {
        const str = getPropertyName(name);
        if (str !== undefined)
            return isValidNumericLiteral(str) && String(+str) === str;
        return isAssignableToNumber(checker.getTypeAtLocation((<ts.ComputedPropertyName>name).expression)); // TODO use isTypeAssignableTo
    }

    function isAssignableToNumber(type: ts.Type) {
        let typeParametersSeen: Set<ts.Type> | undefined;
        return (function check(t): boolean {
            if (isTypeParameter(t) && t.symbol !== undefined && t.symbol.declarations !== undefined) {
                if (typeParametersSeen === undefined) {
                    typeParametersSeen = new Set([t]);
                } else if (!typeParametersSeen.has(t)) {
                    typeParametersSeen.add(t);
                } else {
                    return false;
                }
                const declaration = <ts.TypeParameterDeclaration>t.symbol.declarations[0];
                if (declaration.constraint === undefined)
                    return true;
                return check(checker.getTypeFromTypeNode(declaration.constraint));
            }
            if (isUnionType(t))
                return t.types.every(check);
            if (isIntersectionType(t))
                return t.types.some(check);

            return isTypeFlagSet(t, ts.TypeFlags.NumberLike | ts.TypeFlags.Any);
        })(type);
    }

    function getMatchingSignature(type: ts.Type, parameters: ReadonlyArray<ts.ParameterDeclaration>): [ts.Signature, boolean] | undefined {
        const minArguments = getMinArguments(parameters);

        const signatures = getSignaturesOfType(type).filter((s) => getNumParameters(s.declaration.parameters) >= minArguments);

        switch (signatures.length) {
            case 0:
                return;
            case 1:
                return [signatures[0], true];
            default: {
                const str = checker.signatureToString(signatures[0], undefined, formatFlags);
                const withoutReturn = removeSignatureReturn(str);
                let returnUsable = true;
                for (let i = 1; i < signatures.length; ++i) { // check if all signatures are the same
                    const sig = checker.signatureToString(signatures[i], undefined, formatFlags);
                    if (str !== sig) {
                        if (withoutReturn !== removeSignatureReturn(sig))
                            return;
                        returnUsable = false;
                    }
                }
                return [signatures[0], returnUsable];
            }
        }
    }
}

function removeSignatureReturn(str: string): string {
    const sourceFile = ts.createSourceFile('tmp.ts', `type T=${str}`, ts.ScriptTarget.ESNext);
    const signature = <ts.FunctionOrConstructorTypeNode>(<ts.TypeAliasDeclaration>sourceFile.statements[0]).type;
    return sourceFile.text.substring(7, signature.parameters.end + 1);
}

function getSignaturesOfType(type: ts.Type): ts.Signature[] {
    if (isUnionType(type)) {
        const signatures = [];
        for (const t of type.types)
            signatures.push(...getSignaturesOfType(t));
        return signatures;
    }
    if (isIntersectionType(type)) {
        let signatures: ts.Signature[] | undefined;
        for (const t of type.types) {
            const sig = getSignaturesOfType(t);
            if (sig.length !== 0) {
                if (signatures !== undefined)
                    return []; // if more than one type of the intersection has call signatures, none of them is useful for inference
                signatures = sig;
            }
        }
        return signatures === undefined ? [] : signatures;
    }
    return type.getCallSignatures();
}

function getNumParameters(parameters: ReadonlyArray<ts.ParameterDeclaration>): number {
    if (parameters.length === 0)
        return 0;
    if (parameters[parameters.length - 1].dotDotDotToken !== undefined)
        return Infinity;
    return parametersExceptThis(parameters).length;
}

function getMinArguments(parameters: ReadonlyArray<ts.ParameterDeclaration>): number {
    let minArguments = parameters.length;
    for (; minArguments > 0; --minArguments) {
        const parameter = parameters[minArguments - 1];
        if (parameter.questionToken === undefined && parameter.initializer === undefined && parameter.dotDotDotToken === undefined)
            break;
    }
    return minArguments;
}

function getIife(node: FunctionExpressionLike): ts.CallExpression | undefined {
    let prev: ts.Node = node;
    let parent = prev.parent!;
    while (parent.kind === ts.SyntaxKind.ParenthesizedExpression) {
        prev = parent;
        parent = prev.parent!;
    }
    if (parent.kind === ts.SyntaxKind.CallExpression && (<ts.CallExpression>parent).expression === prev)
        return <ts.CallExpression>parent;
}

function containsTypeWithFlag(type: ts.Type, flag: ts.TypeFlags): boolean {
    return isUnionType(type) ? type.types.some((t) => isTypeFlagSet(t, flag)) : isTypeFlagSet(type, flag);
}

function parametersExceptThis(parameters: ReadonlyArray<ts.ParameterDeclaration>) {
    return parameters.length !== 0 && isThisParameter(parameters[0]) ? parameters.slice(1) : parameters;
}

function functionHasTypeDeclarations(func: ts.FunctionLikeDeclaration): boolean {
    return func.type !== undefined || parametersExceptThis(func.parameters).some((p) => p.type !== undefined);
}

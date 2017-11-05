import * as ts from 'typescript';
import * as Lint from 'tslint';
import { isTypeParameter, getVariableDeclarationKind, VariableDeclarationKind } from 'tsutils';

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
            // TODO methods in object literals
                checkFunctionParameters(<FunctionExpressionLike>node);
                // TODO check return type - add option
                break;
            case ts.SyntaxKind.VariableDeclarationList:
                // TODO add an option where to put the type annotation for functions (variable or function)
                checkVariables(<ts.VariableDeclarationList>node);
        }
        return ts.forEachChild(node, cb);
    });

    function checkFunctionParameters(node: FunctionExpressionLike) {
        // TODO use getContextuallyTypedParameterType
        if (!node.parameters.some((p) => p.type !== undefined && p.dotDotDotToken === undefined))
            return;
        if (isIife(node))
            return checkIife(node.parameters, node.parent.parent.arguments);

        const contextualType = checker.getContextualType(node);
        if (contextualType === undefined)
            return;
        const callSignatures = contextualType.getCallSignatures();
        // TODO choose the correct signature?
        if (callSignatures.length !== 1)
            return;
        const signature = callSignatures[0];
        for (let i = 0; i < node.parameters.length; ++i) {
            const parameter = node.parameters[i];
            if (parameter.dotDotDotToken !== undefined || parameter.type === undefined)
                continue;
            const context = signature.parameters[i];
            if (context === undefined || context.declarations === undefined)
                break;
            const declaredType = checker.getTypeAtLocation(context.declarations[0]);
            if (isTypeParameter(declaredType))
                continue;
            const type = checker.getTypeFromTypeNode(parameter.type);
            const contextualParameterType = checker.getTypeOfSymbolAtLocation(context, node);
            if (type === contextualParameterType)
                fail(parameter.type);
        }
    }

    function checkIife(parameters: ReadonlyArray<ts.ParameterDeclaration>, args: ReadonlyArray<ts.Expression>) {
        const len = Math.min(parameters.length, args.length);
        for (let i = 0; i < len; ++i) {
            const {type, dotDotDotToken} = parameters[i];
            if (type === undefined || dotDotDotToken !== undefined)
                continue;
            if (checker.getTypeFromTypeNode(type) === checker.getBaseTypeOfLiteralType(checker.getTypeAtLocation(args[i])))
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
            if (declared === inferred || isConst && declared === checker.getBaseTypeOfLiteralType(inferred))
                fail(variable.type);
        }
    }

    function fail(type: ts.TypeNode) {
        ctx.addFailure(type.pos - 1, type.end, FAIL_MESSAGE, Lint.Replacement.deleteFromTo(type.pos - 1, type.end));
    }
}

function isIife<T extends FunctionExpressionLike>(node: T): node is T & {parent: ts.ParenthesizedExpression & {parent: ts.CallExpression}} {
    return node.parent!.kind === ts.SyntaxKind.ParenthesizedExpression &&
        node.parent!.parent!.kind === ts.SyntaxKind.CallExpression &&
        (<ts.CallExpression>node.parent!.parent).expression === node.parent;
}

import * as ts from 'typescript';
import * as Lint from 'tslint';
import {
    isParameterDeclaration, isParameterProperty, isFunctionWithBody, isExpressionValueUsed,
    collectVariableUsage, VariableInfo, VariableUse, UsageDomain, isAssignmentKind,
} from 'tsutils';

const OPTION_FUNCTION_EXPRESSION_NAME = 'unused-function-expression-name';
const OPTION_CLASS_EXPRESSION_NAME = 'unused-class-expression-name';
const OPTION_CATCH_BINDING = 'unused-catch-binding';
const OPTION_IGNORE_PARAMETERS = 'ignore-parameters';
const OPTION_IGNORE_IMPORTS = 'ignore-imports';

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new UnusedWalker(sourceFile, this.ruleName, {
            functionExpressionName: this.ruleArguments.indexOf(OPTION_FUNCTION_EXPRESSION_NAME) !== -1,
            classExpressionName: this.ruleArguments.indexOf(OPTION_CLASS_EXPRESSION_NAME) !== -1,
            ignoreParameters: this.ruleArguments.indexOf(OPTION_IGNORE_PARAMETERS) !== -1,
            ignoreImports: this.ruleArguments.indexOf(OPTION_IGNORE_IMPORTS) !== -1,
            catchBinding: this.ruleArguments.indexOf(OPTION_CATCH_BINDING) !== -1,
        }));
    }
}

interface IOptions {
    functionExpressionName: boolean;
    classExpressionName: boolean;
    ignoreParameters: boolean;
    ignoreImports: boolean;
    catchBinding: boolean;
}

const enum ExpressionKind {
    Function = 'Function',
    Class = 'Class',
}

class UnusedWalker extends Lint.AbstractWalker<IOptions> {
    public walk(sourceFile: ts.SourceFile) {
        const usage = collectVariableUsage(sourceFile);
        usage.forEach((variable, identifier) => {
            if (isExcluded(variable, sourceFile, usage, this.options))
                return;
            switch (identifier.parent!.kind) {
                case ts.SyntaxKind.FunctionExpression:
                    if (variable.uses.length === 0 && this.options.functionExpressionName)
                        this._failNamedExpression(identifier, ExpressionKind.Function);
                    return;
                case ts.SyntaxKind.ClassExpression:
                    if (variable.uses.length === 0 && this.options.classExpressionName)
                        this._failNamedExpression(identifier, ExpressionKind.Class);
                    return;
            }
            if (variable.uses.length === 0)
                return this.addFailureAtNode(identifier, `${showKind(identifier)} '${identifier.text}' is unused.`);
            let uses = filterWriteOnly(variable.uses, identifier);
            if (uses.length === 0)
                return this.addFailureAtNode(identifier, `${showKind(identifier)} '${identifier.text}' is only written and never read.`);
            const filtered = uses.length !== variable.uses.length;
            uses = filterUsesInDeclaration(uses, variable.declarations);
            if (uses.length === 0)
                return this.addFailureAtNode(
                    identifier,
                    `${showKind(identifier)} '${identifier.text}' is only ${filtered ? 'written or ' : ''}used inside of its declaration.`,
                );
            // TODO error for classes / functions only used mutually recursive
            // TODO handle JSDoc references in JS files
        });
    }

    private _failNamedExpression(identifier: ts.Identifier, kind: ExpressionKind) {
        this.addFailureAtNode(
            identifier,
            `${kind} '${identifier.text}' is never used by its name. Convert it to an anonymous ${kind.toLocaleLowerCase()} expression.`,
            Lint.Replacement.deleteFromTo(identifier.pos, identifier.end),
        );
    }
}

function filterUsesInDeclaration(uses: VariableUse[], declarations: ts.Identifier[]): VariableUse[] {
    const result = [];
    outer: for (const use of uses) {
        for (const declaration of declarations) {
            const parent = declaration.parent!;
            if (use.location.pos > parent.pos && use.location.pos < parent.end &&
                (parent.kind !== ts.SyntaxKind.VariableDeclaration ||
                 initializerHasNoSideEffect(<ts.VariableDeclaration>parent, use.location)))
                continue outer;

        }
        result.push(use);
    }
    return result;
}

function initializerHasNoSideEffect(declaration: ts.VariableDeclaration, use: ts.Identifier): boolean {
    if (declaration.initializer === undefined)
        return true;
    const enum Result {
        HasSideEffect = 1,
        NoSideEffect = 2,
    }
    return (function cb(node: ts.Expression): Result | undefined {
        if (node.pos > use.pos)
            return Result.NoSideEffect;
        if (node.end <= use.pos)
            return;
        switch (node.kind) {
            case ts.SyntaxKind.CallExpression:
            case ts.SyntaxKind.NewExpression:
            case ts.SyntaxKind.TaggedTemplateExpression:
                return Result.HasSideEffect;
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ClassExpression:
                return Result.NoSideEffect;
        }
        return ts.forEachChild(node, cb);
    })(declaration.initializer) !== Result.HasSideEffect;
}

function filterWriteOnly(uses: VariableUse[], identifier: ts.Identifier): VariableUse[] {
    const result = [];
    for (const use of uses)
        if (use.domain & (UsageDomain.Type | UsageDomain.TypeQuery) ||
            isExpressionValueUsed(use.location) && !isUpdate(use.location, identifier))
            result.push(use);
    return result;
}

// handle foo = foo + 1;
function isUpdate(use: ts.Expression, identifier: ts.Identifier): boolean {
    while (true) {
        const parent = use.parent!;
        switch (parent.kind) {
            case ts.SyntaxKind.ParenthesizedExpression:
            case ts.SyntaxKind.NonNullExpression:
            case ts.SyntaxKind.TypeAssertionExpression:
            case ts.SyntaxKind.AsExpression:
            case ts.SyntaxKind.PrefixUnaryExpression:
            case ts.SyntaxKind.PostfixUnaryExpression:
            case ts.SyntaxKind.TypeOfExpression:
            case ts.SyntaxKind.ConditionalExpression:
            case ts.SyntaxKind.SpreadElement:
            case ts.SyntaxKind.SpreadAssignment:
            case ts.SyntaxKind.ObjectLiteralExpression:
            case ts.SyntaxKind.ArrayLiteralExpression:
                use = <ts.Expression>parent;
                break;
            case ts.SyntaxKind.PropertyAssignment:
            case ts.SyntaxKind.ShorthandPropertyAssignment:
            case ts.SyntaxKind.TemplateSpan:
                use = <ts.Expression>parent.parent;
                break;
            case ts.SyntaxKind.BinaryExpression:
                if (isAssignmentKind((<ts.BinaryExpression>parent).operatorToken.kind))
                    return (<ts.BinaryExpression>parent).right === use &&
                        (<ts.BinaryExpression>parent).left.kind === ts.SyntaxKind.Identifier &&
                        (<ts.Identifier>(<ts.BinaryExpression>parent).left).text === identifier.text;
                use = <ts.Expression>parent;
                break;
            default:
                return false;
        }
    }
}

function isExcluded(variable: VariableInfo, sourceFile: ts.SourceFile, usage: Map<ts.Identifier, VariableInfo>, opts: IOptions): boolean {
    if (variable.exported || variable.inGlobalScope)
        return true;
    for (const declaration of variable.declarations) {
        const parent = declaration.parent!;
        if (declaration.text.startsWith('_')) {
            switch (parent.kind) {
                case ts.SyntaxKind.Parameter:
                    return true;
                case ts.SyntaxKind.VariableDeclaration:
                    if (parent.parent!.parent!.kind === ts.SyntaxKind.ForInStatement ||
                        parent.parent!.parent!.kind === ts.SyntaxKind.ForOfStatement)
                        return true;
                    break;
                case ts.SyntaxKind.BindingElement:
                    if ((<ts.BindingElement>parent).dotDotDotToken !== undefined)
                        break;
                    const pattern = <ts.BindingPattern>parent.parent;
                    if (pattern.kind === ts.SyntaxKind.ObjectBindingPattern &&
                        pattern.elements[pattern.elements.length - 1].dotDotDotToken !== undefined)
                        return true;
            }
        }
        if (isParameterDeclaration(parent) &&
                (opts.ignoreParameters || isParameterProperty(parent) || !isFunctionWithBody(parent.parent!)) ||
            !opts.catchBinding && parent.kind === ts.SyntaxKind.VariableDeclaration && parent.parent!.kind === ts.SyntaxKind.CatchClause ||
            parent.kind === ts.SyntaxKind.TypeParameter && parent.parent!.kind === ts.SyntaxKind.MappedType ||
            parent.kind === ts.SyntaxKind.TypeParameter && typeParameterMayBeRequired(<ts.TypeParameterDeclaration>parent, usage))
            return true;
        // exclude imports in TypeScript files, because is may be used implicitly by the declaration emitter
        if (/\.tsx?$/.test(sourceFile.fileName) && !sourceFile.isDeclarationFile && opts.ignoreImports) {
            switch (parent.kind) {
                case ts.SyntaxKind.ImportEqualsDeclaration:
                    if ((<ts.ImportEqualsDeclaration>parent).moduleReference.kind === ts.SyntaxKind.ExternalModuleReference)
                        return true;
                    break;
                case ts.SyntaxKind.NamespaceImport:
                case ts.SyntaxKind.ImportSpecifier:
                case ts.SyntaxKind.ImportClause:
                    return true;
            }
        }
    }
    return false;
}

function typeParameterMayBeRequired(parameter: ts.TypeParameterDeclaration, usage: Map<ts.Identifier, VariableInfo>): boolean {
    let parent: ts.Node = parameter.parent!;
    switch (parent.kind) {
        default:
            return false;
        case ts.SyntaxKind.InterfaceDeclaration:
        case ts.SyntaxKind.ClassDeclaration:
            if (typeParameterIsUsed(parameter, usage))
                return true;
            if ((<ts.NamedDeclaration>parent).name === undefined)
                return false;
            const variable = usage.get(<ts.Identifier>(<ts.NamedDeclaration>parent).name)!;
            if (!variable.exported)
                return variable.inGlobalScope;
    }
    parent = parent.parent!;
    while (true) {
        switch (parent.kind) {
            case ts.SyntaxKind.ModuleBlock:
                parent = parent.parent!;
                break;
            case ts.SyntaxKind.ModuleDeclaration:
                if ((<ts.ModuleDeclaration>parent).name.kind !== ts.SyntaxKind.Identifier)
                    return true;
                const variable = usage.get(<ts.Identifier>(<ts.ModuleDeclaration>parent).name)!;
                if (!variable.exported)
                    return variable.inGlobalScope;
                parent = parent.parent!;
                break;
            default:
                return false;
        }
    }
}

/** Check if TypeParameter is used in any of the merged declarations. */
function typeParameterIsUsed(parameter: ts.TypeParameterDeclaration, usage: Map<ts.Identifier, VariableInfo>): boolean {
    if (usage.get(parameter.name)!.uses.length !== 0)
        return true;
    const parent = <ts.ClassDeclaration | ts.InterfaceDeclaration>parameter.parent;
    if (parent.name === undefined)
        return false;
    const index = parent.typeParameters!.indexOf(parameter);
    for (const declaration of usage.get(parent.name)!.declarations) {
        const declarationParent = <ts.DeclarationWithTypeParameters>declaration.parent;
        if (declarationParent === parent)
            continue;
        switch (declarationParent.kind) {
            case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.InterfaceDeclaration:
                if (declarationParent.typeParameters !== undefined &&
                    declarationParent.typeParameters.length > index &&
                    usage.get(declarationParent.typeParameters[index].name)!.uses.length !== 0)
                    return true;
        }
    }
    return false;
}

function showKind(node: ts.Identifier): string {
    switch (node.parent!.kind) {
        case ts.SyntaxKind.BindingElement:
        case ts.SyntaxKind.VariableDeclaration:
            return 'Variable';
        case ts.SyntaxKind.Parameter:
            return 'Parameter';
        case ts.SyntaxKind.FunctionDeclaration:
            return 'Function';
        case ts.SyntaxKind.ClassDeclaration:
            return 'Class';
        case ts.SyntaxKind.InterfaceDeclaration:
            return 'Interface';
        case ts.SyntaxKind.ImportClause:
        case ts.SyntaxKind.NamespaceImport:
        case ts.SyntaxKind.ImportSpecifier:
        case ts.SyntaxKind.ImportEqualsDeclaration:
            return 'Import';
        case ts.SyntaxKind.EnumDeclaration:
            return 'Enum';
        case ts.SyntaxKind.ModuleDeclaration:
            return 'Namespace';
        case ts.SyntaxKind.TypeAliasDeclaration:
            return 'TypeAlias';
        case ts.SyntaxKind.TypeParameter:
            return 'TypeParameter';
        default:
            throw new Error(`Unhandled kind ${node.parent!.kind}: ${ts.SyntaxKind[node.parent!.kind]}`);
    }
}

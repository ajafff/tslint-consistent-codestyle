import * as ts from 'typescript';
import * as Lint from 'tslint';
import {
    isParameterDeclaration, isParameterProperty, isFunctionWithBody, isExpressionValueUsed,
    collectVariableUsage, VariableInfo, VariableUse, UsageDomain,
} from 'tsutils';

const OPTION_FUNCTION_EXPRESSION_NAME = 'unused-function-expression-name';
const OPTION_CLASS_EXPRESSION_NAME = 'unused-class-expression-name';

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new UnusedWalker(sourceFile, this.ruleName, {
            functionExpressionName: this.ruleArguments.indexOf(OPTION_FUNCTION_EXPRESSION_NAME) !== -1,
            classExpressionName: this.ruleArguments.indexOf(OPTION_CLASS_EXPRESSION_NAME) !== -1,
        }));
    }
}

interface IOptions {
    functionExpressionName: boolean;
    classExpressionName: boolean;
}

const enum ExpressionKind {
    Function = 'Function',
    Class = 'Class',
}

class UnusedWalker extends Lint.AbstractWalker<IOptions> {
    public walk(sourceFile: ts.SourceFile) {
        const usage = collectVariableUsage(sourceFile);
        usage.forEach((variableInfo, identifier) => {
            if (isExcluded(variableInfo, sourceFile))
                return;
            let uses = variableInfo.uses;
            switch (identifier.parent!.kind) {
                case ts.SyntaxKind.FunctionExpression:
                    if (uses.length === 0 && this.options.functionExpressionName)
                        this._failNamedExpression(identifier, ExpressionKind.Function);
                    return;
                case ts.SyntaxKind.ClassExpression:
                    if (uses.length === 0 && this.options.classExpressionName)
                        this._failNamedExpression(identifier, ExpressionKind.Class);
                    return;
            }
            if (uses.length === 0)
                return this.addFailureAtNode(identifier, `${showKind(identifier)} '${identifier.text}' is unused.`);
            uses = filterWriteOnly(uses);
            if (uses.length === 0)
                return this.addFailureAtNode(identifier, `${showKind(identifier)} '${identifier.text}' is only written and never read.`);
            // TODO handle variables (references to functions) only used inside of their initializer
            // TODO error for classes / functions only used inside of their body
            // TODO error for classes / functions only used mutually recursive
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

function filterWriteOnly(uses: VariableUse[]): VariableUse[] {
    // TODO handle foo = foo + 1;
    const result = [];
    for (const use of uses)
        if (use.domain & UsageDomain.Type || isExpressionValueUsed(use.location))
            result.push(use);
    return result;
}

function isExcluded(variable: VariableInfo, sourceFile: ts.SourceFile): boolean {
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
            (isParameterProperty(parent) || !isFunctionWithBody(parent.parent!)) ||
            parent.kind === ts.SyntaxKind.VariableDeclaration && parent.parent!.kind === ts.SyntaxKind.CatchClause ||
            parent.kind === ts.SyntaxKind.TypeParameter && parent.parent!.kind === ts.SyntaxKind.MappedType)
            return true;
        // exclude imports in TypeScript files, because is may be used implicitly by the declaration emitter
        if (/\.tsx?$/.test(sourceFile.fileName) && !sourceFile.fileName.endsWith('.d.ts')) {
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

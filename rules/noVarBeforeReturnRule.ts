import * as ts from 'typescript';
import * as Lint from 'tslint';

import {isUndefined, getPreviousStatement} from '../src/utils';

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new ReturnWalker(sourceFile, this.getOptions()));
    }
}

class ReturnWalker extends Lint.RuleWalker {
    public visitReturnStatement(node: ts.ReturnStatement) {
        if (node.expression !== undefined && node.expression.kind === ts.SyntaxKind.Identifier) {
            const name = (<ts.Identifier>node.expression).text;
            const statement = getPreviousStatement(node);
            if (statement !== undefined) {
                if (statement.kind === ts.SyntaxKind.VariableStatement) {
                    const declarationList = (<ts.VariableStatement>statement).declarationList.declarations;
                    if (bindingNameContains(declarationList[declarationList.length - 1].name, name, true)) {
                        const sourceFile = this.getSourceFile();
                        this.addFailure(this.createFailure(node.expression.getStart(sourceFile),
                                                           node.expression.getWidth(sourceFile),
                                                           `don't declare variable ${name} to return it immediately`));
                    }
                }
            }
        }
        super.visitReturnStatement(node);
    }
}

function destructDeclarationContains(pattern: ts.BindingPattern, name: string, ignoreDefaults?: boolean): boolean {
    for (let element of pattern.elements) {
        if (element.kind !== ts.SyntaxKind.BindingElement)
            continue;

        const bindingElement = <ts.BindingElement>element;
        // defaulting to undefined is not really a default -> check for undefined and void initializer
        if (ignoreDefaults && bindingElement.initializer !== undefined && !isUndefined(bindingElement.initializer))
            continue;

        if (bindingNameContains(bindingElement.name, name))
            return true;
    }
    return false;
}

function bindingNameContains(bindingName: ts.BindingName, name: string, ignoreDefaults?: boolean): boolean {
    return bindingName.kind === ts.SyntaxKind.Identifier ?
           (<ts.Identifier>bindingName).text === name :
           destructDeclarationContains(bindingName, name, ignoreDefaults);
}

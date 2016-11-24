import * as ts from 'typescript';
import * as Lint from 'tslint';

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new ReturnWalker(sourceFile, this.getOptions()));
    }
}

class ReturnWalker extends Lint.RuleWalker {
    public visitReturnStatement(node: ts.ReturnStatement) {
        if (node.expression !== undefined && node.expression.kind === ts.SyntaxKind.Identifier) {
            const name = (<ts.Identifier>node.expression).text;
            const children = (<ts.BlockLike>node.parent).statements;
            const index = children.indexOf(node);
            if (index > 0) {
                const statement = children[index - 1];
                if (statement.kind === ts.SyntaxKind.VariableStatement && isOnlyDeclaration(<ts.VariableStatement>statement, name)) {
                    const sourceFile = this.getSourceFile();
                    this.addFailure(this.createFailure(node.expression.getStart(sourceFile),
                                                       node.expression.getWidth(sourceFile),
                                                       'don\'t declare a variable to return it immediately'));
                }
            }
        }
        super.visitReturnStatement(node);
    }
}

function isOnlyDeclaration(statement: ts.VariableStatement, name: string): boolean {
    if (statement.declarationList.declarations.length > 1)
        return false;

    return bindingNameContains(statement.declarationList.declarations[0].name, name);
}

function destructDeclarationContains(pattern: ts.BindingPattern, name: string): boolean {
    for (let element of pattern.elements) {
        if (element.kind === ts.SyntaxKind.BindingElement && bindingNameContains((<ts.BindingElement>element).name, name))
            return true;
    }
    return false;
}

function bindingNameContains(bindingName: ts.BindingName, name: string): boolean {
    return bindingName.kind === ts.SyntaxKind.Identifier ?
           (<ts.Identifier>bindingName).text === name :
           destructDeclarationContains(bindingName, name);
}

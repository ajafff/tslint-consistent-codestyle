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
            const sourceFile = this.getSourceFile();
            // TODO irgendwie sinnvoll an die SyntaxList kommen
            const children = (<ts.Block>node.parent).statements;
            const index = children.indexOf(node);
            if (index > 0) {
                const statement = children[index - 1];
                if (statement.kind === ts.SyntaxKind.VariableStatement && declaresVariable(<ts.VariableStatement>statement, name))
                    this.addFailure(this.createFailure(node.expression.getStart(sourceFile),
                                                       node.expression.getWidth(sourceFile),
                                                       'don\'t assign variable to return it immediately'));
            }
        }
        super.visitReturnStatement(node);
    }
}

function declaresVariable(statement: ts.VariableStatement, name: string): boolean {
    // TODO use option to determine if only check single variable declarations
    let found = false;
    let used = false;
    function walk(node: ts.Node) {
        if (found) {
            if (used)
                return; // nothing to do here

            if (node.kind === ts.SyntaxKind.Identifier && (<ts.Identifier>node).text === name) {
                used = true;
                return;
            }
        } else if (node.kind === ts.SyntaxKind.VariableDeclaration) {
            const declaration = <ts.VariableDeclaration>node;
            if (declaration.name.kind === ts.SyntaxKind.Identifier && (<ts.Identifier>declaration.name).text === name) {
                found = true;
                return;
            }
        }
        ts.forEachChild(node, walk);
    }
    ts.forEachChild(statement, walk);
    return found && !used;
}

import * as ts from 'typescript';
import * as Lint from 'tslint';

import { bindingNameContains, getPreviousStatement } from '../src/utils';
import { isIdentifier } from '../src/typeguard';
import { ReturnStatementWalker } from '../src/walker';

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new ReturnWalker(sourceFile, this.getOptions()));
    }
}

class ReturnWalker extends ReturnStatementWalker {
    public visitReturnStatement(node: ts.ReturnStatement) {
        if (node.expression !== undefined && isIdentifier(node.expression)) {
            const statement = getPreviousStatement(node);
            if (statement !== undefined && statement.kind === ts.SyntaxKind.VariableStatement) {
                const declarations = (<ts.VariableStatement>statement).declarationList.declarations;
                if (bindingNameContains(declarations[declarations.length - 1].name, node.expression.text, true)) {
                    const sourceFile = this.getSourceFile();
                    this.addFailure(this.createFailure(node.expression.getStart(sourceFile),
                                                        node.expression.getWidth(sourceFile),
                                                        `don't declare variable ${node.expression.text} to return it immediately`));
                }
            }
        }
    }
}

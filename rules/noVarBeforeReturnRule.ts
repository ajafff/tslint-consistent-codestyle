import * as ts from 'typescript';
import * as Lint from 'tslint';

import {bindingNameContains, getPreviousStatement} from '../src/utils';
import {ReturnStatementWalker} from '../src/walker';

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new ReturnWalker(sourceFile, this.getOptions()));
    }
}

class ReturnWalker extends ReturnStatementWalker {
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
    }
}

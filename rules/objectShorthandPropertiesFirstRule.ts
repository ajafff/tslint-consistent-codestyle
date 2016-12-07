import * as ts from 'typescript';
import * as Lint from 'tslint';

import { ObjectLiteralWalker } from '../src/walker';

const FAIL_MESSAGE = `shorthand properties should come first`;

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new ObjectWalker(sourceFile, this.getOptions()));
    }
}

class ObjectWalker extends ObjectLiteralWalker {
    public visitObjectLiteralExpression(node: ts.ObjectLiteralExpression) {
        let seenRegularProperty = false;
        const sourceFile = this.getSourceFile();
        for (const property of node.properties) {
            if (property.kind === ts.SyntaxKind.PropertyAssignment) {
                seenRegularProperty = true;
            } else if (seenRegularProperty && property.kind === ts.SyntaxKind.ShorthandPropertyAssignment) {
                this.addFailure(this.createFailure(property.getStart(sourceFile),
                                                   property.getWidth(sourceFile),
                                                   FAIL_MESSAGE));
            }
        }
    }
}

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
        for (const property of node.properties) {
            if (property.kind === ts.SyntaxKind.PropertyAssignment) {
                seenRegularProperty = true;
            } else if (property.kind === ts.SyntaxKind.SpreadAssignment) {
                // reset at spread, because ordering matters
                seenRegularProperty = false;
            } else if (seenRegularProperty && property.kind === ts.SyntaxKind.ShorthandPropertyAssignment) {
                this.addFailureAtNode(property, FAIL_MESSAGE);
            }
        }
    }
}

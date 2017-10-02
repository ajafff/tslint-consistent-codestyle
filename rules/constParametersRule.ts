/**
 * @license
 * Copyright 2017 Palantir Technologies, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { collectVariableUsage, getDeclarationOfBindingElement, isReassignmentTarget, getJsDoc, parseJsDocOfNode } from 'tsutils';
import * as ts from 'typescript';
import * as Lint from 'tslint';

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk);
    }
}

function walk(ctx: Lint.WalkContext<void>): void {
    collectVariableUsage(ctx.sourceFile).forEach((variable, identifier) => {
        if (!isParameter(identifier.parent!) || !isConst(identifier, ctx.sourceFile))
            return;
        for (const use of variable.uses)
            if (isReassignmentTarget(use.location))
                ctx.addFailureAtNode(use.location, `Cannot reassign constant parameter '${identifier.text}'.`);
    });
}

function isParameter(node: ts.Node): boolean {
    switch (node.kind) {
        case ts.SyntaxKind.Parameter:
            return true;
        case ts.SyntaxKind.BindingElement:
            return getDeclarationOfBindingElement(<ts.BindingElement>node).kind === ts.SyntaxKind.Parameter;
        default:
            return false;
    }
}

function isConst(name: ts.Identifier, sourceFile: ts.SourceFile) {
    if (name.parent!.kind === ts.SyntaxKind.Parameter)
        return getJsDoc(name.parent!, sourceFile).some(jsDocContainsConst);
    // destructuring
    return parseJsDocOfNode(name, true, sourceFile).some(jsDocContainsConst);
}

function jsDocContainsConst(jsDoc: ts.JSDoc): boolean {
    if (jsDoc.tags !== undefined)
        for (const tag of jsDoc.tags)
            if (tag.tagName.text === 'const' || tag.tagName.text === 'constant')
                return true;
    return false;
}

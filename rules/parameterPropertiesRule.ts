import * as ts from 'typescript';
import * as Lint from 'tslint';
import * as utils from 'tsutils';

import { AbstractConfigDependentRule } from '../src/rules';

const ALL_OR_NONE_OPTION = 'all-or-none';
const LEADING_OPTION = 'leading';
const TRAILING_OPTION = 'trailing';
const READONLY_OPTION = 'readonly';
const MEMBER_ACCESS_OPTION = 'member-access';

const ALL_OR_NONE_FAIL = 'don\'t mix parameter properties with regular parameters';
const LEADING_FAIL = 'parameter properties must precede regular parameters';
const TRAILING_FAIL = 'regular parameters must precede parameter properties';
const READONLY_FAIL = 'parameter property must be readonly';
const MEMBER_ACCESS_FAIL = 'parameter property must have access modifier';

// TODO
//  - no parameter use
//  - no reassign
//   - no reassign parameter
//   - no reassign property
//  - no reassign readonly
//   - no reassign readonly parameter
//   - no reassign readonly property

interface IOptions {
    allOrNone: boolean;
    leading: boolean;
    trailing: boolean;
    readOnly: boolean;
    memberAccess: boolean;
}

export class Rule extends AbstractConfigDependentRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new ParameterPropertyWalker(sourceFile, this.ruleName, {
            allOrNone: this.ruleArguments.indexOf(ALL_OR_NONE_OPTION) !== -1,
            leading: this.ruleArguments.indexOf(LEADING_OPTION) !== -1,
            trailing: this.ruleArguments.indexOf(TRAILING_OPTION) !== -1,
            readOnly: this.ruleArguments.indexOf(READONLY_OPTION) !== -1,
            memberAccess: this.ruleArguments.indexOf(MEMBER_ACCESS_OPTION) !== -1,
        }));
    }
}

class ParameterPropertyWalker extends Lint.AbstractWalker<IOptions> {
    public walk(sourceFile: ts.SourceFile) {
        const cb = (node: ts.Node): void => {
            if (node.kind === ts.SyntaxKind.Constructor)
                this._checkConstructorDeclaration(<ts.ConstructorDeclaration>node);
            return ts.forEachChild(node, cb);
        };
        return ts.forEachChild(sourceFile, cb);
    }

    private _checkConstructorDeclaration(node: ts.ConstructorDeclaration) {
        const parameters = node.parameters;
        const length = parameters.length;
        if (length === 0)
            return;

        let index = -1;
        for (let i = 0; i < length; ++i) {
            if (utils.isParameterProperty(parameters[i])) {
                index = i;
                break;
            }
        }
        if (index === -1)
            return;

        if (this.options.allOrNone) {
            const start = parameters[0].getStart(this.getSourceFile());
            const end = parameters[parameters.length - 1].getEnd();
            if (index > 0) {
                this.addFailure(start, end, ALL_OR_NONE_FAIL);
            } else {
                for (let i = index + 1; i < length; ++i) {
                    if (!utils.isParameterProperty(parameters[i])) {
                        this.addFailure(start, end, ALL_OR_NONE_FAIL);
                        break;
                    }
                }
            }
        } else if (this.options.leading) {
            let regular = index > 0;
            for (let i = index; i < length; ++i) {
                if (utils.isParameterProperty(parameters[i])) {
                    if (regular)
                        this.addFailureAtNode(parameters[i], LEADING_FAIL);
                } else {
                    regular = true;
                }
            }
        } else if (this.options.trailing) {
            for (let i = index; i < length; ++i)
                if (!utils.isParameterProperty(parameters[i]))
                    this.addFailureAtNode(parameters[i], TRAILING_FAIL);
        }

        if (this.options.memberAccess) {
            for (let i = index; i < length; ++i) {
                const parameter = parameters[i];
                if (utils.isParameterProperty(parameter) && !utils.hasAccessModifier(parameter))
                    this.addFailureAtNode(parameter, MEMBER_ACCESS_FAIL);
            }
        }

        if (this.options.readOnly) {
            for (let i = index; i < length; ++i) {
                const parameter = parameters[i];
                if (utils.isParameterProperty(parameter) && !utils.hasModifier(parameter.modifiers, ts.SyntaxKind.ReadonlyKeyword))
                    this.addFailureAtNode(parameter, READONLY_FAIL);
            }
        }
    }
}

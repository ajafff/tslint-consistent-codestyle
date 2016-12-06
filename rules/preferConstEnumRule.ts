import { isElementAccessExpression, isIdentifier, isLiteralExpression, isPropertyAccessExpression } from '../src/typeguard';
import { getPropertyName } from '../src/utils';
import * as ts from 'typescript';
import * as Lint from 'tslint';

const FAIL_MESSAGE = `enum can be declared const`;

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new ReturnWalker(sourceFile, this.getOptions()));
    }
}

interface IEnum {
    name: string;
    isConst: boolean;
    occurences: ts.EnumDeclaration[];
    members: IMember[];
    canBeConst: boolean;
}

interface IMember {
    name: string;
    const: boolean;
}

class ReturnWalker extends Lint.RuleWalker {
    private _enums = new Map<string, IEnum>();

    private _addEnum(node: ts.EnumDeclaration): IEnum {
        let trackingStructure = this._enums.get(node.name.text);
        if (trackingStructure === undefined) {
            trackingStructure = {
                name: node.name.text,
                isConst: Lint.hasModifier(node.modifiers, ts.SyntaxKind.ConstKeyword),
                occurences: [],
                members: [],
                canBeConst: true,
            };
            this._enums.set(node.name.text, trackingStructure);
        }
        trackingStructure.occurences.push(node);
        return trackingStructure;
    }

    public walk(sourceFile: ts.SourceFile) {
        super.walk(sourceFile);
        this._enums.forEach((track) => {
            if (!track.isConst && track.canBeConst) {
                for (let occurence of track.occurences) {
                    const start = occurence.getStart(sourceFile);
                    const width = occurence.name.getEnd() - start;
                    this.addFailure(this.createFailure(start, width, FAIL_MESSAGE));
                }
            }
        });
    }

    public visitEnumDeclaration(node: ts.EnumDeclaration) {
        const track = this._addEnum(node);
        const enums = this._enums;
        function* getEnums() {
            for (let value of enums.values()) {
                yield value;
            }
        }
        for (let member of node.members) {
            const isConstMember = track.isConst ||
                    member.initializer === undefined ||
                    isConstInitializer(member.initializer, track.members, getEnums);
            track.canBeConst = track.canBeConst && isConstMember;
            track.members.push({
                name: getPropertyName(member.name)!,
                const: isConstMember,
            });
        }
        super.visitEnumDeclaration(node);
    }

    private _checkAccess(node: ts.ElementAccessExpression) {
        if (isIdentifier(node.expression) &&
            node.argumentExpression !== undefined &&
            // literal access is ok
            !isLiteralExpression(node.argumentExpression)) {
            const track = this._enums.get(node.expression.text);
            if (track !== undefined) {
                track.canBeConst = false;
            }
        }
    }

    public visitNode(node: ts.Node) {
        if (isElementAccessExpression(node))
            this._checkAccess(node);

        super.visitNode(node);
    }
}

function isConstInitializer(initializer: ts.Expression, members: IMember[], enums: () => IterableIterator<IEnum>): boolean {
    // brainfuck: ts.forEachChild stops when truthy value is returned, so we need to invert every boolean
    const isNotConst = (current: ts.Expression): boolean => {
        if (isIdentifier(current)) {
            for (let member of members) {
                if (current.text === member.name)
                    return !member.const;
            }
            return true;
        }
        if (isPropertyAccessExpression(current)) {
            if (!isIdentifier(current.expression))
                return true;
            for (let track of enums()) {
                if (track.name === current.expression.text) {
                    for (let member of track.members) {
                        if (member.name === current.name.text)
                            return !member.const;
                    }
                }
            }
            return true;
        }
        if (isElementAccessExpression(current)) {
            if (current.argumentExpression === undefined ||
                !isLiteralExpression(current.argumentExpression) ||
                !isIdentifier(current.expression))
                return true;
            for (let track of enums()) {
                if (track.name === current.expression.text) {
                    for (let member of track.members) {
                        if (member.name === current.argumentExpression.text)
                            return !member.const;
                    }
                }
            }
            return true;
        }

        return ts.forEachChild(current, isNotConst);
    };

    return !isNotConst(initializer);
}

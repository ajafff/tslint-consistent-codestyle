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
    members: Map<string, boolean>;
    canBeConst: boolean;
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
                members: new Map<string, boolean>(),
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
            track.members.set(getPropertyName(member.name)!, isConstMember);
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

function isConstInitializer(initializer: ts.Expression, members: Map<string, boolean>, enums: () => IterableIterator<IEnum>): boolean {
    // brainfuck: ts.forEachChild stops when truthy value is returned, so we need to invert every boolean
    const checkNotConst = (current: ts.Expression): boolean => {
        if (isIdentifier(current))
            return !members.get(current.text);
        if (isPropertyAccessExpression(current)) {
            if (!isIdentifier(current.expression))
                return true;
            for (let track of enums()) {
                if (track.name === current.expression.text)
                    return !track.members.get(current.name.text);
            }
            return true;
        }
        if (isElementAccessExpression(current)) {
            if (current.argumentExpression === undefined ||
                !isLiteralExpression(current.argumentExpression) ||
                !isIdentifier(current.expression))
                return true;
            for (let track of enums()) {
                if (track.name === current.expression.text)
                    return !track.members.get(current.argumentExpression.text);
            }
            return true;
        }

        return ts.forEachChild(current, checkNotConst);
    };

    return !checkNotConst(initializer);
}

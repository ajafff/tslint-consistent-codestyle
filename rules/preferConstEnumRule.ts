import * as ts from 'typescript';
import * as Lint from 'tslint';
import {
    collectVariableUsage, hasModifier, VariableUse, getPropertyName, isIdentifier, isPropertyAccessExpression, isElementAccessExpression,
    isStringLiteral, isBinaryExpression, isAssignmentKind, UsageDomain,
} from 'tsutils';

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk);
    }
}

interface IEnum {
    name: string;
    isConst: boolean;
    declarations: ts.EnumDeclaration[];
    members: Map<string, IEnumMember>;
    canBeConst: boolean;
    uses: VariableUse[];
}

interface IEnumMember {
    isConst: boolean;
    stringValued: boolean;
}

interface IDeclaration {
    track: IEnum;
    declaration: ts.EnumDeclaration;
}

function walk(ctx: Lint.WalkContext<void>) {
    const seen = new Set<ts.Identifier>();
    const enums: IEnum[] = [];
    const declarations: IDeclaration[] = [];
    const variables = collectVariableUsage(ctx.sourceFile);
    variables.forEach((variable, identifier) => {
        if (identifier.parent!.kind !== ts.SyntaxKind.EnumDeclaration || seen.has(identifier))
            return;
        const track: IEnum = {
            name: identifier.text,
            isConst: hasModifier(identifier.parent!.modifiers, ts.SyntaxKind.ConstKeyword),
            declarations: [],
            members: new Map(),
            canBeConst: !variable.inGlobalScope && !variable.exported,
            uses: variable.uses,
        };
        for (const declaration of variable.declarations) {
            seen.add(declaration);
            if (declaration.parent!.kind !== ts.SyntaxKind.EnumDeclaration) {
                // TODO review with ts>=2.5.0, maybe const enum can merge with namespace
                // https://github.com/Microsoft/TypeScript/issues/16804
                track.canBeConst = false;
            } else {
                track.declarations.push(<ts.EnumDeclaration>declaration.parent);
                declarations.push({
                    track,
                    declaration: <ts.EnumDeclaration>declaration.parent},
                );
            }
        }
        enums.push(track);
    });
    declarations.sort((a, b) => a.declaration.pos - b.declaration.pos);
    for (const {track, declaration} of declarations) {
        for (const member of declaration.members) {
            const isConst = track.isConst ||
                member.initializer === undefined ||
                isConstInitializer(member.initializer, track.members, findEnum);
            track.members.set(getPropertyName(member.name)!, {
                isConst,
                stringValued: isConst && member.initializer !== undefined && isStringValued(member.initializer, track.members, findEnum),
            });
            if (!isConst)
                track.canBeConst = false;
        }
    }
    for (const track of enums) {
        if (track.isConst || !track.canBeConst || !onlyConstUses(track))
            continue;
        for (const declaration of track.declarations)
            ctx.addFailure(
                declaration.name.pos - 4,
                declaration.name.end,
                `Enum '${track.name}' can be a 'const enum'.`,
                Lint.Replacement.appendText(declaration.name.pos - 4, 'const '),
            );
    }

    function findEnum(name: ts.Identifier): IEnum | undefined {
        for (const track of enums) {
            if (track.name !== name.text)
                continue;
            for (const use of track.uses)
                if (use.location === name)
                    return track;
        }
    }
}

function onlyConstUses(track: IEnum): boolean {
    for (const use of track.uses) {
        if (use.domain & UsageDomain.Type || use.domain === UsageDomain.Namespace)
            continue;
        if (use.domain & UsageDomain.TypeQuery)
            return false;
        const parent = use.location.parent!;
        switch (parent.kind) {
            default:
                return false;
            case ts.SyntaxKind.ElementAccessExpression:
                if ((<ts.ElementAccessExpression>parent).argumentExpression === undefined ||
                    (<ts.ElementAccessExpression>parent).argumentExpression!.kind !== ts.SyntaxKind.StringLiteral)
                    return false;
                break;
            case ts.SyntaxKind.PropertyAccessExpression:
        }
    }
    return true;
}

type FindEnum = (name: ts.Identifier) => IEnum | undefined;

function isConstInitializer(initializer: ts.Expression, members: Map<string, IEnumMember>, findEnum: FindEnum): boolean {
    return (function isConst(node: ts.Expression, allowStrings: boolean): boolean {
        switch (node.kind) {
            case ts.SyntaxKind.Identifier:
                const member = members.get((<ts.Identifier>node).text);
                return member !== undefined && member.isConst && (allowStrings || !member.stringValued);
            case ts.SyntaxKind.StringLiteral:
                return allowStrings;
            case ts.SyntaxKind.NumericLiteral:
                return true;
            case ts.SyntaxKind.PrefixUnaryExpression:
                return isConst((<ts.PrefixUnaryExpression>node).operand, false);
            case ts.SyntaxKind.ParenthesizedExpression:
                return isConst((<ts.ParenthesizedExpression>node).expression, allowStrings);
        }
        if (isPropertyAccessExpression(node)) {
            if (!isIdentifier(node.expression))
                return false;
            const track = findEnum(node.expression);
            if (track === undefined)
                return false;
            const member = track.members.get(node.name.text);
            return member !== undefined && member.isConst && (allowStrings || !member.stringValued);
        }
        if (isElementAccessExpression(node)) {
            if (!isIdentifier(node.expression) || node.argumentExpression === undefined || !isStringLiteral(node.argumentExpression))
                return false;
            const track = findEnum(node.expression);
            if (track === undefined)
                return false;
            const member = track.members.get(node.argumentExpression.text);
            return member !== undefined && member.isConst && (allowStrings || !member.stringValued);
        }
        if (isBinaryExpression(node))
            // TODO revisit 1 ** 2 in later versions of typescript
            return node.operatorToken.kind !== ts.SyntaxKind.AsteriskAsteriskToken &&
                node.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken &&
                node.operatorToken.kind !== ts.SyntaxKind.BarBarToken &&
                !isAssignmentKind(node.operatorToken.kind) &&
                isConst(node.left, false) && isConst(node.right, false);
        return false;
    })(initializer, true);
}

function isStringValued(initializer: ts.Expression, members: Map<string, IEnumMember>, findEnum: FindEnum): boolean {
    return (function stringValued(node: ts.Expression): boolean {
        switch (node.kind) {
            case ts.SyntaxKind.ParenthesizedExpression:
                return stringValued((<ts.ParenthesizedExpression>node).expression);
            case ts.SyntaxKind.Identifier:
                return members.get((<ts.Identifier>node).text)!.stringValued;
            case ts.SyntaxKind.PropertyAccessExpression:
                return findEnum(<ts.Identifier>(<ts.PropertyAccessExpression>node).expression)!
                    .members.get((<ts.PropertyAccessExpression>node).name.text)!.stringValued;
            case ts.SyntaxKind.ElementAccessExpression:
                return findEnum(<ts.Identifier>(<ts.ElementAccessExpression>node).expression)!
                    .members.get((<ts.Identifier>(<ts.ElementAccessExpression>node).argumentExpression).text)!.stringValued;
            default: // StringLiteral
                return true;
        }
    })(initializer);
}

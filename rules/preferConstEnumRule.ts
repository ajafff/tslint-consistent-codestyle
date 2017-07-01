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
    members: Map<string, boolean>;
    canBeConst: boolean;
    uses: VariableUse[];
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
            track.members.set(getPropertyName(member.name)!, isConst);
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
        if (use.domain & (UsageDomain.Type | UsageDomain.TypeQuery))
            continue;
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

function isConstInitializer(initializer: ts.Expression, members: Map<string, boolean>, findEnum: FindEnum): boolean {
    return (function isConst(node: ts.Expression): boolean {
        switch (node.kind) {
            case ts.SyntaxKind.Identifier:
                return members.get((<ts.Identifier>node).text) === true;
            case ts.SyntaxKind.StringLiteral:
            case ts.SyntaxKind.NumericLiteral:
                return true;
            case ts.SyntaxKind.PrefixUnaryExpression:
                return isConst((<ts.PrefixUnaryExpression>node).operand);
            case ts.SyntaxKind.ParenthesizedExpression:
                return isConst((<ts.ParenthesizedExpression>node).expression);
        }
        if (isPropertyAccessExpression(node)) {
            if (!isIdentifier(node.expression))
                return false;
            const track = findEnum(node.expression);
            return track !== undefined && track.members.get(node.name.text) === true;
        }
        if (isElementAccessExpression(node)) {
            if (!isIdentifier(node.expression) || node.argumentExpression === undefined || !isStringLiteral(node.argumentExpression))
                return false;
            const track = findEnum(node.expression);
            return track !== undefined && track.members.get(node.argumentExpression.text) === true;
        }
        if (isBinaryExpression(node))
            // TODO revisit 1 ** 2 in later versions of typescript
            return node.operatorToken.kind !== ts.SyntaxKind.AsteriskAsteriskToken &&
                !isAssignmentKind(node.operatorToken.kind) &&
                isConst(node.left) && isConst(node.right);
        return false;
    })(initializer);
}

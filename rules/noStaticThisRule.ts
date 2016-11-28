import * as ts from 'typescript';
import * as Lint from 'tslint';

const FAIL_MESSAGE = `don't use this in static methods`;
const RESTRICT_ACCESSOR_OPTION = 'restrict-accessor';

export class Rule extends Lint.Rules.AbstractRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new StaticMethodWalker(sourceFile, this.getOptions()));
    }
}

class StaticMethodWalker extends Lint.ScopeAwareRuleWalker<boolean> {
    private _restrictAccessor: boolean;
    constructor(sourceFile: ts.SourceFile, options: Lint.IOptions) {
        super(sourceFile, options);

        this._restrictAccessor = options.ruleArguments !== undefined &&
                                 options.ruleArguments.indexOf(RESTRICT_ACCESSOR_OPTION) !== -1;
    }

    public createScope(node: ts.Node): boolean {
        return (node.kind === ts.SyntaxKind.MethodDeclaration ||
                node.kind === ts.SyntaxKind.GetAccessor ||
                node.kind === ts.SyntaxKind.SetAccessor) &&
               Lint.hasModifier(node.modifiers, ts.SyntaxKind.StaticKeyword);
    }

    private _displayError(node: ts.ThisExpression) {
        this.addFailure(this.createFailure(node.getStart(this.getSourceFile()), 4, FAIL_MESSAGE));
    }

    public visitNode(node: ts.Node) {
        if (node.kind === ts.SyntaxKind.ThisKeyword && this.getCurrentScope())
            this._displayError(<ts.ThisExpression>node);
        super.visitNode(node);
    }
}

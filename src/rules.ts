import * as Lint from 'tslint';

export abstract class AbstractConfigDependentRule extends Lint.Rules.AbstractRule {
    public isEnabled(): boolean {
        return super.isEnabled() && this.ruleArguments.length !== 0;
    }
}

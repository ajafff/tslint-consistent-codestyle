import * as Lint from 'tslint';

export abstract class AbstractConfigDependentRule extends Lint.Rules.AbstractRule {
    public isEnabled(): boolean {
        if (super.isEnabled())
            return true;

        const args = this.getOptions().ruleArguments;
        return args !== undefined && args.length !== 0;
    }
}
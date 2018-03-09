import { wrapTslintRule } from '@fimbul/bifrost';
import { Rule } from '../noElseAfterReturnRule';

const rule = wrapTslintRule(Rule);
export {rule as Rule};

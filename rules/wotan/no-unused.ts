import { wrapTslintRule } from '@fimbul/bifrost';
import { Rule } from '../noUnusedRule';

const rule = wrapTslintRule(Rule);
export {rule as Rule};

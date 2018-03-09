import { wrapTslintRule } from '@fimbul/bifrost';
import { Rule } from '../noAsTypeAssertionRule';

const rule = wrapTslintRule(Rule);
export {rule as Rule};

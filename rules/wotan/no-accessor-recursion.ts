import { wrapTslintRule } from '@fimbul/bifrost';
import { Rule } from '../noAccessorRecursionRule';

const rule = wrapTslintRule(Rule);
export {rule as Rule};

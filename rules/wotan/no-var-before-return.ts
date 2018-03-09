import { wrapTslintRule } from '@fimbul/bifrost';
import { Rule } from '../noVarBeforeReturnRule';

const rule = wrapTslintRule(Rule);
export {rule as Rule};

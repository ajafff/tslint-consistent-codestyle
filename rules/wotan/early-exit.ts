import { wrapTslintRule } from '@fimbul/bifrost';
import { Rule } from '../earlyExitRule';

const rule = wrapTslintRule(Rule);
export {rule as Rule};

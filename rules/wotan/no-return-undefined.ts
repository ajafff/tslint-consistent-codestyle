import { wrapTslintRule } from '@fimbul/bifrost';
import { Rule } from '../noReturnUndefinedRule';

const rule = wrapTslintRule(Rule);
export {rule as Rule};

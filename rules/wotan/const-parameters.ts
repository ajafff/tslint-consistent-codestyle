import { wrapTslintRule } from '@fimbul/bifrost';
import { Rule } from '../constParametersRule';

const rule = wrapTslintRule(Rule);
export {rule as Rule};

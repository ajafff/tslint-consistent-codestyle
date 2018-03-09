import { wrapTslintRule } from '@fimbul/bifrost';
import { Rule } from '../namingConventionRule';

const rule = wrapTslintRule(Rule);
export {rule as Rule};

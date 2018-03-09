import { wrapTslintRule } from '@fimbul/bifrost';
import { Rule } from '../extCurlyRule';

const rule = wrapTslintRule(Rule);
export {rule as Rule};

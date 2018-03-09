import { wrapTslintRule } from '@fimbul/bifrost';
import { Rule } from '../preferWhileRule';

const rule = wrapTslintRule(Rule);
export {rule as Rule};

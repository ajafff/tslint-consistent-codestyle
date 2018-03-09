import { wrapTslintRule } from '@fimbul/bifrost';
import { Rule } from '../noUnnecessaryElseRule';

const rule = wrapTslintRule(Rule);
export {rule as Rule};

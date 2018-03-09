import { wrapTslintRule } from '@fimbul/bifrost';
import { Rule } from '../noCollapsibleIfRule';

const rule = wrapTslintRule(Rule);
export {rule as Rule};

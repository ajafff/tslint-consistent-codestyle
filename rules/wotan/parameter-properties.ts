import { wrapTslintRule } from '@fimbul/bifrost';
import { Rule } from '../parameterPropertiesRule';

const rule = wrapTslintRule(Rule);
export {rule as Rule};

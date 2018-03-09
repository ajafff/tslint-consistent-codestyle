import { wrapTslintRule } from '@fimbul/bifrost';
import { Rule } from '../objectShorthandPropertiesFirstRule';

const rule = wrapTslintRule(Rule);
export {rule as Rule};

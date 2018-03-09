import { wrapTslintRule } from '@fimbul/bifrost';
import { Rule } from '../noUnnecessaryTypeAnnotationRule';

const rule = wrapTslintRule(Rule);
export {rule as Rule};

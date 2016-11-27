import * as ts from 'typescript';
import * as Lint from 'tslint';

import { isIdentifier, isParameterProperty } from '../src/utils';
import {AbstractConfigDependentRule} from '../src/rules';

// TODO don't flag inherited members
// TODO check renamed imports
// TODO skip all ambient declarations

const PASCAL_OPTION = 'PascalCase';
const CAMEL_OPTION  = 'camelCase';
const SNAKE_OPTION  = 'snake_case';
const UPPER_OPTION  = 'UPPER_CASE';

const CAMEL_FAIL    = ' name must be in camelCase';
const PASCAL_FAIL   = ' name must be in PascalCase';
const SNAKE_FAIL    = ' name must be in snake_case';
const UPPER_FAIL    = ' name must be in UPPER_CASE';
const LEADING_FAIL  = ' name must not have leading underscore';
const TRAILING_FAIL = ' name must not have trailing underscore';
const NO_LEADING_FAIL  = ' name must have leading underscore';
const NO_TRAILING_FAIL = ' name must have trailing underscore';
const REGEX_FAIL    = ' name did not match required regex';
const PREFIX_FAIL   = ' name must start with ';
const SUFFIX_FAIL   = ' name must end with ';
const PREFIX_FAIL_ARR  = ' name must start with one of ';
const SUFFIX_FAIL_ARR  = ' name must end with one of ';

type DeclarationWithIdentifierName = ts.Declaration & {name: ts.Identifier};

type TFormat = 'camelCase' | 'PascalCase' | 'snake_case' | 'UPPER_CASE';
type IdentifierType = 'class' | 'interface' | 'function' | 'variable' | 'method' |
                      'property' | 'parameter' | 'default' | 'member' | 'type' |
                      'genericTypeParameter';
type Modifier = 'static' | 'const' | 'export' | 'public' | 'protected' |
                'private' | 'abstract' | 'global' | 'local' | 'readonly';

type UnderscoreOption = 'allow' | 'require' | 'forbid';

interface IRuleScope {
    type: IdentifierType;
    modifiers?: Modifier | Modifier[];
}

type IRuleConfig = IRuleScope & IFormat;

interface IFormat {
    format?: TFormat;
    leadingUnderscore?: UnderscoreOption;
    trailingUnderscore?: UnderscoreOption;
    prefix?: string|string[];
    suffix?: string|string[];
    regex?: string;
}

enum Types {
    default = -1,
    variable = 1,
    function = 1 << 1,
    parameter = 1 << 2,
    member = 1 << 3,
    property = 1 << 4,
    method = 1 << 5,
    type = 1 << 6,
    class = 1 << 7,
    interface = 1 << 8,
    typeAlias = 1 << 9,
    genericTypeParameter = 1 << 10,
    enum = 1 << 11,
    enumMember = 1 << 12,
}

enum TypeSelector {
    variable = Types.variable,
    function = variable | Types.function,
    parameter = variable | Types.parameter,
    property = Types.member | Types.property,
    parameterProperty = parameter | property,
    method = Types.member | Types.method,
    class = Types.type | Types.class,
    interface = Types.type | Types.interface,
    typeAlias = Types.type | Types.typeAlias,
    genericTypeParameter = Types.type | Types.genericTypeParameter,
    enum = Types.type | Types.enum,
    enumMember = property | Types.enumMember,
}

enum Modifiers {
    const = 1,
    readonly = Modifiers.const,
    static = 2,
    public = 4,
    protected = 8,
    private = 16,
    global = 32,
    local = 64,
    abstract = 128,
    export = 256,
}

enum Specifity {
    const = 1,
    readonly = Specifity.const,
    static = 1 << 1,
    global = Specifity.static,
    local = Specifity.static,
    public = 1 << 2,
    protected = Specifity.public,
    private = Specifity.public,
    abstract = 1 << 3,
    export = 1 << 4,
    import = 1 << 5,
    default = 1 << 6,
    variable = 2 << 6,
    function = Specifity.variable,
    parameter = 3 << 6,
    member = 4 << 6,
    property = 5 << 6,
    method = Specifity.property,
    enumMember = 6 << 6,
    type = 7 << 6,
    class = 8 << 6,
    interface = Specifity.class,
    typeAlias = Specifity.class,
    genericTypeParameter = Specifity.class,
    enum = Specifity.class,
}

export class Rule extends AbstractConfigDependentRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new IdentifierNameWalker(sourceFile, this.getOptions()));
    }
}

class NormalizedConfig {
    private _type: Types;
    private _format: IFormat;
    private _modifiers: number;
    private _specifity: number;

    constructor(raw: IRuleConfig) {
        this._type = Types[raw.type];
        this._specifity = Specifity[raw.type];
        this._modifiers = 0;
        if (raw.modifiers !== undefined) {
            if (Array.isArray(raw.modifiers)) {
                for (let modifier of raw.modifiers) {
                    this._modifiers |= Modifiers[modifier];
                    this._specifity |= Specifity[modifier];
                }
            } else {
                this._modifiers = Modifiers[raw.modifiers];
                this._specifity |= Specifity[raw.modifiers];
            }
        }
        this._format = raw;
    }

    public matches(type: TypeSelector, modifiers: number) {
        return (this._type & type) !== 0 && (this._modifiers & ~modifiers) === 0;
    }

    public getFormat(): IFormat {
        return this._format;
    }

    public static sort(first: NormalizedConfig, second: NormalizedConfig): number {
        return first._specifity - second._specifity;
    }
}

class NameChecker {
    private _format?: string;
    private _leadingUnderscore?: UnderscoreOption;
    private _trailingUnderscore?: UnderscoreOption;
    private _prefix?: string|string[];
    private _suffix?: string|string[];
    private _regex?: RegExp;
    constructor(private readonly _type: TypeSelector, format: IFormat) {
        if (format.format)
            this._format = format.format;
        if (format.leadingUnderscore && format.leadingUnderscore !== 'allow')
            this._leadingUnderscore = format.leadingUnderscore;
        if (format.trailingUnderscore && format.trailingUnderscore !== 'allow')
            this._trailingUnderscore = format.trailingUnderscore;
        if (format.prefix) {
            if (!Array.isArray(format.prefix) || format.prefix.length > 1) {
                this._prefix = format.prefix;
            } else if (format.prefix.length === 1) {
                this._prefix = format.prefix[0];
            }
        }
        if (format.suffix) {
            if (!Array.isArray(format.suffix) || format.suffix.length > 1) {
                this._suffix = format.suffix;
            } else if (format.suffix.length === 1) {
                this._suffix = format.suffix[0];
            }
        }
        if (format.regex)
            this._regex = new RegExp(format.regex);
    }

    private _failMessage(message: string): string {
        return TypeSelector[this._type] + message;
    }

    public check(name: ts.Identifier, walker: Lint.RuleWalker) {
        const sourceFile = walker.getSourceFile();
        let identifier = name.text;

        // start with regex test before we potentially strip off underscores and affixes
        if (this._regex !== undefined && !this._regex.test(identifier))
            walker.addFailure(walker.createFailure(name.getStart(sourceFile),
                                                   name.getWidth(sourceFile),
                                                   this._failMessage(REGEX_FAIL)));

        if (this._leadingUnderscore !== undefined) {
            if (identifier[0] === '_') {
                if (this._leadingUnderscore === 'forbid')
                    walker.addFailure(walker.createFailure(name.getStart(sourceFile),
                                                           name.getWidth(sourceFile),
                                                           this._failMessage(LEADING_FAIL)));
                identifier = identifier.slice(1);
            } else if (this._leadingUnderscore === 'require') {
                walker.addFailure(walker.createFailure(name.getStart(sourceFile),
                                                       name.getWidth(sourceFile),
                                                       this._failMessage(NO_LEADING_FAIL)));
            }
        }

        if (this._trailingUnderscore !== undefined) {
            if (identifier[identifier.length - 1] === '_') {
                if (this._trailingUnderscore === 'forbid')
                    walker.addFailure(walker.createFailure(name.getStart(sourceFile),
                                                           name.getWidth(sourceFile),
                                                           this._failMessage(TRAILING_FAIL)));
                identifier = identifier.slice(0, -1);
            } else if (this._trailingUnderscore === 'require') {
                walker.addFailure(walker.createFailure(name.getStart(sourceFile),
                                                       name.getWidth(sourceFile),
                                                       this._failMessage(NO_TRAILING_FAIL)));
            }
        }

        if (this._prefix !== undefined) {
            if (Array.isArray(this._prefix)) {
                identifier = this._checkPrefixes(identifier, name, this._prefix, walker);
            } else if (identifier.slice(0, this._prefix.length) === this._prefix) {
                identifier = identifier.slice(this._prefix.length);
            } else {
                walker.addFailure(walker.createFailure(name.getStart(sourceFile),
                                                       name.getWidth(sourceFile),
                                                       this._failMessage(PREFIX_FAIL + this._prefix)));
            }
        }
        if (this._suffix !== undefined) {
            if (Array.isArray(this._suffix)) {
                identifier = this._checkSuffixes(identifier, name, this._suffix, walker);
            } else if (identifier.indexOf(this._suffix, identifier.length - this._suffix.length) !== -1) {
                identifier = identifier.slice(0, -this._suffix.length);
            } else {
                walker.addFailure(walker.createFailure(name.getStart(sourceFile),
                                                       name.getWidth(sourceFile),
                                                       this._failMessage(SUFFIX_FAIL + this._suffix)));
            }
        }

        // run case checks
        switch (this._format) {
            case PASCAL_OPTION:
                if (!isPascalCase(identifier))
                    walker.addFailure(walker.createFailure(name.getStart(sourceFile),
                                                           name.getWidth(sourceFile),
                                                           this._failMessage(PASCAL_FAIL)));
                break;
            case CAMEL_OPTION:
                if (!isCamelCase(identifier))
                    walker.addFailure(walker.createFailure(name.getStart(sourceFile),
                                                           name.getWidth(sourceFile),
                                                           this._failMessage(CAMEL_FAIL)));
                break;
            case SNAKE_OPTION:
                if (!isSnakeCase(identifier))
                    walker.addFailure(walker.createFailure(name.getStart(sourceFile),
                                                           name.getWidth(sourceFile),
                                                           this._failMessage(SNAKE_FAIL)));
                break;
            case UPPER_OPTION:
                if (!isUpperCase(identifier))
                    walker.addFailure(walker.createFailure(name.getStart(sourceFile),
                                                           name.getWidth(sourceFile),
                                                           this._failMessage(UPPER_FAIL)));
                break;
        }
    }

    private _checkPrefixes(identifier: string, name: ts.Identifier, prefixes: string[], walker: Lint.RuleWalker): string {
        for (let prefix of prefixes) {
            if (identifier.slice(0, prefix.length) === prefix)
                return identifier.slice(prefix.length);
        }
        const sourceFile = walker.getSourceFile();
        walker.addFailure(walker.createFailure(name.getStart(sourceFile),
                                               name.getWidth(sourceFile),
                                               this._failMessage(PREFIX_FAIL_ARR + prefixes.toString())));
        return identifier;
    }

    private _checkSuffixes(identifier: string, name: ts.Identifier, suffixes: string[], walker: Lint.RuleWalker): string {
        for (let suffix of suffixes) {
            if (identifier.indexOf(suffix, identifier.length - suffix.length) !== -1)
                return identifier.slice(-suffix.length);
        }
        const sourceFile = walker.getSourceFile();
        walker.addFailure(walker.createFailure(name.getStart(sourceFile),
                                               name.getWidth(sourceFile),
                                               this._failMessage(SUFFIX_FAIL_ARR + suffixes.toString())));
        return identifier;
    }

}

class IdentifierNameWalker extends Lint.ScopeAwareRuleWalker<ts.Node> {
    private _rules: NormalizedConfig[];
    private _cache: Map<string, NameChecker>;

    constructor(sourceFile: ts.SourceFile, options: Lint.IOptions) {
        super(sourceFile, options);
        this._rules = this._normalizeRules(<IRuleConfig[]> options.ruleArguments);
        this._cache = new Map<string, NameChecker>();
    }

    public createScope(node: ts.Node): ts.Node {
        return node;
    }

    private _normalizeRules(rules: IRuleConfig[]): NormalizedConfig[] {
        return rules.map((rule) => {
            return new NormalizedConfig(rule);
        }).sort(NormalizedConfig.sort);
    }

    private _checkTypeParameters(node: ts.DeclarationWithTypeParameters, modifiers: Modifiers) {
        if (node.typeParameters !== undefined) {
            for (let typeParameter of node.typeParameters) {
                this._checkName(typeParameter.name, TypeSelector.genericTypeParameter, modifiers);
            }
        }
    }

    public visitEnumDeclaration(node: ts.EnumDeclaration) {
        let modifiers = this._getModifiers(node, TypeSelector.enum);
        this._checkName(node.name, TypeSelector.enum, modifiers);
        modifiers |= Modifiers.static | Modifiers.public; // treat enum members as static properties
        for (let {name} of node.members) {
            if (isIdentifier(name))
                this._checkName(name, TypeSelector.enumMember, modifiers);
        }
        super.visitEnumDeclaration(node);
    }

    public visitTypeAliasDeclaration(node: ts.TypeAliasDeclaration) {
        this._checkDeclaration(node, TypeSelector.typeAlias);
        this._checkTypeParameters(node, Modifiers.global);
        super.visitTypeAliasDeclaration(node);
    }

    public visitClassExpression(node: ts.ClassExpression) {
        if (node.name !== undefined)
            this._checkDeclaration(<ts.ClassExpression & {name: ts.Identifier}>node, TypeSelector.class);
        this._checkTypeParameters(node, Modifiers.global);
        super.visitClassExpression(node);
    }

    public visitClassDeclaration(node: ts.ClassDeclaration) {
        if (node.name !== undefined)
            this._checkDeclaration(<ts.ClassDeclaration & {name: ts.Identifier}>node, TypeSelector.class);
        this._checkTypeParameters(node, Modifiers.global);
        super.visitClassDeclaration(node);
    }

    public visitMethodDeclaration(node: ts.MethodDeclaration) {
        if (isNameIdentifier(node))
            this._checkDeclaration(node, TypeSelector.method);
        this._checkTypeParameters(node, Modifiers.local);
        super.visitMethodDeclaration(node);
    }

    public visitInterfaceDeclaration(node: ts.InterfaceDeclaration) {
        this._checkDeclaration(node, TypeSelector.interface);
        this._checkTypeParameters(node, Modifiers.global);
        super.visitInterfaceDeclaration(node);
    }

    public visitParameterDeclaration(node: ts.ParameterDeclaration) {
        if (isNameIdentifier(node)) {
            // param properties cannot be destructuring assignments
            this._checkDeclaration(node,
                                   isParameterProperty(node) ? TypeSelector.parameterProperty
                                                             : TypeSelector.parameter);
        } else {
            // handle destructuring
            foreachDeclaredIdentifier(node.name, (name) => {
                this._checkName(name, TypeSelector.parameter, Modifiers.local);
            });
        }

        super.visitParameterDeclaration(node);
    }

    public visitPropertyDeclaration(node: ts.PropertyDeclaration) {
        if (isNameIdentifier(node))
            this._checkDeclaration(node, TypeSelector.property);
        super.visitPropertyDeclaration(node);
    }

    public visitSetAccessor(node: ts.SetAccessorDeclaration) {
        if (isNameIdentifier(node))
            this._checkDeclaration(node, TypeSelector.property);
        super.visitSetAccessor(node);
    }

    public visitGetAccessor(node: ts.GetAccessorDeclaration) {
        if (isNameIdentifier(node))
            this._checkDeclaration(node, TypeSelector.property);
        super.visitGetAccessor(node);
    }

    public visitVariableStatement(node: ts.VariableStatement) {
        // skip 'declare' keywords
        if (!Lint.hasModifier(node.modifiers, ts.SyntaxKind.DeclareKeyword)) {
            // compute modifiers once and reuse for all declared variables
            let modifiers = this.getCurrentDepth() === 1 ? Modifiers.global : Modifiers.local;
            if (Lint.isNodeFlagSet(node.declarationList, ts.NodeFlags.Const))
                modifiers |= Modifiers.const;
            const cb = (name: ts.Identifier) => this._checkName(name, TypeSelector.variable, modifiers);
            for (let declaration of node.declarationList.declarations) {
                // handle identifiers and destructuring
                foreachDeclaredIdentifier(declaration.name, cb);
            }
            super.visitVariableStatement(node);
        }
    }

    public visitFunctionDeclaration(node: ts.FunctionDeclaration) {
        if (node.name !== undefined)
            this._checkDeclaration(<ts.FunctionDeclaration & {name: ts.Identifier}>node, TypeSelector.function);
        this._checkTypeParameters(node, Modifiers.local);
        super.visitFunctionDeclaration(node);
    }

    public visitFuncitonExpression(node: ts.FunctionExpression) {
        if (node.name !== undefined)
            this._checkDeclaration(<ts.FunctionExpression & {name: ts.Identifier}>node, TypeSelector.function);
        this._checkTypeParameters(node, Modifiers.local);
        super.visitFunctionExpression(node);
    }

    public visitArrowFunction(node: ts.ArrowFunction) {
        this._checkTypeParameters(node, Modifiers.local);
        super.visitArrowFunction(node);
    }

    private _checkDeclaration(node: DeclarationWithIdentifierName, type: TypeSelector) {
        this._checkName(node.name, type, this._getModifiers(node, type));
    }

    private _checkName(name: ts.Identifier, type: TypeSelector, modifiers: number) {
        const matchingChecker = this._getMatchingChecker(type, modifiers);
            if (matchingChecker !== undefined)
                matchingChecker.check(name, this);
    }

    private _getMatchingChecker(type: TypeSelector, modifiers: number): NameChecker|undefined {
        const key = `${type},${modifiers}`;
        if (this._cache.has(key))
            return this._cache.get(key);

        const checker = this._createChecker(type, modifiers);
        this._cache.set(key, checker);
        return checker;
    }

    private _createChecker(type: TypeSelector, modifiers: number): NameChecker|undefined {
        const config = this._rules.reduce<IFormat>(
            (format, rule) => {
                if (!rule.matches(type, modifiers))
                    return format;

                const ruleFormat = rule.getFormat();
                if (ruleFormat.leadingUnderscore !== undefined)
                    format.leadingUnderscore = ruleFormat.leadingUnderscore;
                if (ruleFormat.trailingUnderscore !== undefined)
                    format.trailingUnderscore = ruleFormat.trailingUnderscore;
                if (ruleFormat.format !== undefined)
                    format.format = ruleFormat.format;
                if (ruleFormat.prefix !== undefined)
                    format.prefix = ruleFormat.prefix;
                if (ruleFormat.regex !== undefined)
                    format.regex = ruleFormat.regex;
                if (ruleFormat.suffix !== undefined)
                    format.suffix = ruleFormat.suffix;
                return format;
            },
            {
                leadingUnderscore: undefined,
                trailingUnderscore: undefined,
                format: undefined,
                prefix: undefined,
                regex: undefined,
                suffix : undefined,
            });

        // ohne Regeln kein Checker
        if (!config.leadingUnderscore &&
            !config.trailingUnderscore &&
            !config.format &&
            !config.prefix &&
            !config.regex &&
            !config.suffix)
            return;

        return new NameChecker(type, config);
    }

    private _getModifiers(node: ts.Node, type: TypeSelector): number {
        let modifiers = 0;
        if (node.modifiers !== undefined) {
            if (type | Types.member) { // property, method, parameter property
                if (Lint.hasModifier(node.modifiers, ts.SyntaxKind.PrivateKeyword)) {
                    modifiers |= Modifiers.private;
                } else if (Lint.hasModifier(node.modifiers, ts.SyntaxKind.ProtectedKeyword)) {
                    modifiers |= Modifiers.protected;
                } else {
                    modifiers |= Modifiers.public;
                }
                if (Lint.hasModifier(node.modifiers, ts.SyntaxKind.ReadonlyKeyword))
                    modifiers |= Modifiers.const;
                if (Lint.hasModifier(node.modifiers, ts.SyntaxKind.StaticKeyword))
                    modifiers |= Modifiers.static;
            }
        }

        if (type !== TypeSelector.property && type !== TypeSelector.method)
            modifiers |= this.getCurrentDepth() > 1 ? Modifiers.local : Modifiers.global;

        if (Lint.hasModifier(node.modifiers, ts.SyntaxKind.ConstKeyword)) // stuff like const enums
            modifiers |= Modifiers.const;

        return modifiers;
    }
}

function isPascalCase(name: string) {
    return name.length === 0 || name[0] === name[0].toUpperCase() && name.indexOf('_') === -1;
}

function isCamelCase(name: string) {
    return name.length === 0 || name[0] === name[0].toLowerCase() && name.indexOf('_') === -1;
}

function isSnakeCase(name: string) {
    return name === name.toLowerCase();
}

function isUpperCase(name: string) {
    return name === name.toUpperCase();
}

function isNameIdentifier(node: ts.Declaration & {name: any}): node is DeclarationWithIdentifierName {
    return node.name.kind === ts.SyntaxKind.Identifier;
}

function foreachDeclaredIdentifier(bindingName: ts.BindingName, cb: (name: ts.Identifier) => void) {
    if (isIdentifier(bindingName))
        return cb(bindingName);

    for (let element of bindingName.elements) {
        if (element.kind === ts.SyntaxKind.BindingElement)
            foreachDeclaredIdentifier((<ts.BindingElement>element).name, cb);
    }
}

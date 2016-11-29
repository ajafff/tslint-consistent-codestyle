import * as ts from 'typescript';
import * as Lint from 'tslint';

import { isIdentifier, isParameterProperty, isScopeBoundary } from '../src/utils';
import {AbstractConfigDependentRule} from '../src/rules';

// TODO don't flag inherited members
// TODO check renamed imports
// TODO skip all ambient declarations
// TODO use startsWith and endsWith

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
    final?: boolean;
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
    static = 1 << 1,
    public = 1 << 2,
    protected = 1 << 3,
    private = 1 << 4,
    global = 1 << 5,
    local = 1 << 6,
    abstract = 1 << 7,
    export = 1 << 8,
    import = 1 << 9,
    original = 1 << 10,
    rename = 1 << 11,
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
    original = 1 << 6,
    rename = Specifity.original,
    default = 1 << 7,
    variable = 2 << 7,
    function = Specifity.variable,
    parameter = 3 << 7,
    member = 4 << 7,
    property = 5 << 7,
    method = Specifity.property,
    enumMember = 6 << 7,
    type = 7 << 7,
    class = 8 << 7,
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
    private _final: boolean;

    constructor(raw: IRuleConfig) {
        this._type = Types[raw.type];
        this._final = !!raw.final;
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
        if (this._final && type > this._type << 1) // check if TypeSelector has a higher bit set than this._type
            return false;
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
        if (format.leadingUnderscore)
            this._leadingUnderscore = format.leadingUnderscore;
        if (format.trailingUnderscore)
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
            } else if (identifier.startsWith(this._prefix)) {
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
            } else if (identifier.endsWith(this._suffix)) {
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
            if (identifier.startsWith(prefix))
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
            if (identifier.endsWith(suffix))
                return identifier.slice(-suffix.length);
        }
        const sourceFile = walker.getSourceFile();
        walker.addFailure(walker.createFailure(name.getStart(sourceFile),
                                               name.getWidth(sourceFile),
                                               this._failMessage(SUFFIX_FAIL_ARR + suffixes.toString())));
        return identifier;
    }

}

class IdentifierNameWalker extends Lint.RuleWalker {
    private _depth = 0;
    private _rules: NormalizedConfig[];
    private _cache: Map<string, NameChecker>;

    constructor(sourceFile: ts.SourceFile, options: Lint.IOptions) {
        super(sourceFile, options);
        this._rules = this._normalizeRules(<IRuleConfig[]> options.ruleArguments);
        this._cache = new Map<string, NameChecker>();
    }

    private _normalizeRules(rules: IRuleConfig[]): NormalizedConfig[] {
        return rules.map((rule) => {
            return new NormalizedConfig(rule);
        }).sort(NormalizedConfig.sort);
    }

    private _checkTypeParameters(node: ts.DeclarationWithTypeParameters, modifiers: Modifiers) {
        if (node.typeParameters !== undefined) {
            for (let {name} of node.typeParameters) {
                this._checkName(name, TypeSelector.genericTypeParameter, modifiers);
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
    }

    public visitTypeAliasDeclaration(node: ts.TypeAliasDeclaration) {
        this._checkDeclaration(node, TypeSelector.typeAlias);
        this._checkTypeParameters(node, Modifiers.global);
    }

    public visitClassExpression(node: ts.ClassExpression) {
        if (node.name !== undefined)
            this._checkDeclaration(<ts.ClassExpression & {name: ts.Identifier}>node, TypeSelector.class);
        this._checkTypeParameters(node, Modifiers.global);
    }

    public visitClassDeclaration(node: ts.ClassDeclaration) {
        if (node.name !== undefined)
            this._checkDeclaration(<ts.ClassDeclaration & {name: ts.Identifier}>node, TypeSelector.class);
        this._checkTypeParameters(node, Modifiers.global);
    }

    public visitMethodDeclaration(node: ts.MethodDeclaration) {
        if (isNameIdentifier(node))
            this._checkDeclaration(node, TypeSelector.method);
        this._checkTypeParameters(node, Modifiers.local);
    }

    public visitInterfaceDeclaration(node: ts.InterfaceDeclaration) {
        this._checkDeclaration(node, TypeSelector.interface);
        this._checkTypeParameters(node, Modifiers.global);
    }

    public visitParameterDeclaration(node: ts.ParameterDeclaration) {
        if (isNameIdentifier(node)) {
            // param properties cannot be destructuring assignments
            const type = isParameterProperty(node) ? TypeSelector.parameterProperty
                                                   : TypeSelector.parameter;
            this._checkName(node.name, type, this._getModifiers(node, type) | Modifiers.original);
        } else {
            // handle destructuring
            foreachDeclaredIdentifier(node.name, (name, original) => {
                this._checkName(name,
                                TypeSelector.parameter,
                                Modifiers.local | (original ? Modifiers.original : Modifiers.rename));
            });
        }

    }

    public visitPropertyDeclaration(node: ts.PropertyDeclaration) {
        if (isNameIdentifier(node))
            this._checkDeclaration(node, TypeSelector.property);
    }

    public visitSetAccessor(node: ts.SetAccessorDeclaration) {
        if (isNameIdentifier(node))
            this._checkDeclaration(node, TypeSelector.property);
    }

    public visitGetAccessor(node: ts.GetAccessorDeclaration) {
        if (isNameIdentifier(node))
            this._checkDeclaration(node, TypeSelector.property);
    }

    private _checkVariableDeclarationList(list: ts.VariableDeclarationList, modifiers: number) {
        // compute modifiers once and reuse for all declared variables
        if (Lint.isNodeFlagSet(list, ts.NodeFlags.Const))
            modifiers |= Modifiers.const;
        const cb = (name: ts.Identifier, original: boolean) => {
            this._checkName(name, TypeSelector.variable, modifiers | (original ? Modifiers.original : Modifiers.rename));
        };
        for (let {name} of list.declarations) {
            // handle identifiers and destructuring
            foreachDeclaredIdentifier(name, cb);
        }
    }

    public visitForStatement(node: ts.ForStatement) {
        if (node.initializer !== undefined && node.initializer.kind === ts.SyntaxKind.VariableDeclarationList)
            this._checkVariableDeclarationList(<ts.VariableDeclarationList>node.initializer, this._getModifiers(node.initializer,
                                                                                                                TypeSelector.variable));
    }

    public visitForOfStatement(node: ts.ForOfStatement) {
        if (node.initializer.kind === ts.SyntaxKind.VariableDeclarationList)
            this._checkVariableDeclarationList(<ts.VariableDeclarationList>node.initializer, this._getModifiers(node.initializer,
                                                                                                                TypeSelector.variable));
    }

    public visitForInStatement(node: ts.ForInStatement) {
        if (node.initializer.kind === ts.SyntaxKind.VariableDeclarationList)
            this._checkVariableDeclarationList(<ts.VariableDeclarationList>node.initializer, this._getModifiers(node.initializer,
                                                                                                                TypeSelector.variable));
    }

    public visitVariableStatement(node: ts.VariableStatement) {
        // skip 'declare' keywords
        if (!Lint.hasModifier(node.modifiers, ts.SyntaxKind.DeclareKeyword)) {
            this._checkVariableDeclarationList(node.declarationList, this._getModifiers(node, TypeSelector.variable));
        }
    }

    public visitFunctionDeclaration(node: ts.FunctionDeclaration) {
        if (node.name !== undefined)
            this._checkDeclaration(<ts.FunctionDeclaration & {name: ts.Identifier}>node, TypeSelector.function);
        this._checkTypeParameters(node, Modifiers.local);
    }

    public visitFuncitonExpression(node: ts.FunctionExpression) {
        if (node.name !== undefined)
            this._checkDeclaration(<ts.FunctionExpression & {name: ts.Identifier}>node, TypeSelector.function);
        this._checkTypeParameters(node, Modifiers.local);
    }

    public visitArrowFunction(node: ts.ArrowFunction) {
        this._checkTypeParameters(node, Modifiers.local);
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
            if (Lint.hasModifier(node.modifiers, ts.SyntaxKind.ConstKeyword)) // stuff like const enums
                modifiers |= Modifiers.const;
            if (Lint.hasModifier(node.modifiers, ts.SyntaxKind.ExportKeyword))
                modifiers |= Modifiers.export;
            if (Lint.hasModifier(node.modifiers, ts.SyntaxKind.AbstractKeyword))
                modifiers |= Modifiers.abstract;
        }

        if (type !== TypeSelector.property && type !== TypeSelector.method)
            modifiers |= this._depth !== 0 ? Modifiers.local : Modifiers.global;

        return modifiers;
    }

    public walk(sourceFile: ts.Node) {
        const cb = (node: ts.Node) => {
            let boundary = isScopeBoundary(node);
            if (boundary)
                ++this._depth;
            this.visitNode(node);
            ts.forEachChild(node, cb);
            if (boundary)
                --this._depth;
        };
        ts.forEachChild(sourceFile, cb);
    }

    public visitNode(node: ts.Node) {
        switch (node.kind) {
            case ts.SyntaxKind.VariableStatement:
                this.visitVariableStatement(<ts.VariableStatement>node);
                break;
            case ts.SyntaxKind.FunctionDeclaration:
                this.visitFunctionDeclaration(<ts.FunctionDeclaration>node);
                break;
            case ts.SyntaxKind.FunctionExpression:
                this.visitFuncitonExpression(<ts.FunctionExpression>node);
                break;
            case ts.SyntaxKind.ForStatement:
                this.visitForStatement(<ts.ForStatement>node);
                break;
            case ts.SyntaxKind.ForInStatement:
                this.visitForInStatement(<ts.ForInStatement>node);
                break;
            case ts.SyntaxKind.ForOfStatement:
                this.visitForOfStatement(<ts.ForOfStatement>node);
                break;
            case ts.SyntaxKind.Parameter:
                this.visitParameterDeclaration(<ts.ParameterDeclaration>node);
                break;
            case ts.SyntaxKind.ClassDeclaration:
                this.visitClassDeclaration(<ts.ClassDeclaration>node);
                break;
            case ts.SyntaxKind.ClassExpression:
                this.visitClassExpression(<ts.ClassExpression>node);
                break;
            case ts.SyntaxKind.InterfaceDeclaration:
                this.visitInterfaceDeclaration(<ts.InterfaceDeclaration>node);
                break;
            case ts.SyntaxKind.EnumDeclaration:
                this.visitEnumDeclaration(<ts.EnumDeclaration>node);
                break;
            case ts.SyntaxKind.TypeAliasDeclaration:
                this.visitTypeAliasDeclaration(<ts.TypeAliasDeclaration>node);
                break;
            case ts.SyntaxKind.PropertyDeclaration:
                this.visitPropertyDeclaration(<ts.PropertyDeclaration>node);
                break;
            case ts.SyntaxKind.MethodDeclaration:
                this.visitMethodDeclaration(<ts.MethodDeclaration>node);
                break;
            case ts.SyntaxKind.GetAccessor:
                this.visitGetAccessor(<ts.GetAccessorDeclaration>node);
                break;
            case ts.SyntaxKind.SetAccessor:
                this.visitSetAccessor(<ts.SetAccessorDeclaration>node);
                break;
            case ts.SyntaxKind.ArrowFunction:
                this.visitArrowFunction(<ts.ArrowFunction>node);
                break;
        }
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

function foreachDeclaredIdentifier(bindingName: ts.BindingName,
                                   cb: (name: ts.Identifier, original: boolean) => void,
                                   propertyName?: ts.PropertyName,
                                   ) {
    if (isIdentifier(bindingName))
        return cb(bindingName,
                  propertyName === undefined ||
                  propertyName.kind === ts.SyntaxKind.Identifier &&
                  (<ts.Identifier>propertyName).text === bindingName.text);

    for (let element of bindingName.elements) {
        if (element.kind === ts.SyntaxKind.BindingElement)
            foreachDeclaredIdentifier((<ts.BindingElement>element).name, cb, (<ts.BindingElement>element).propertyName);
    }
}

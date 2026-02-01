// ISL TextMate Grammar for Shiki syntax highlighting
import type { LanguageRegistration } from 'shiki';

export const islGrammar: LanguageRegistration = {
  name: 'isl',
  scopeName: 'source.isl',
  patterns: [
    { include: '#comments' },
    { include: '#strings' },
    { include: '#keywords' },
    { include: '#types' },
    { include: '#modifiers' },
    { include: '#operators' },
    { include: '#numbers' },
    { include: '#punctuation' },
  ],
  repository: {
    comments: {
      patterns: [
        {
          name: 'comment.line.double-slash.isl',
          match: '//.*$',
        },
        {
          name: 'comment.block.isl',
          begin: '/\\*',
          end: '\\*/',
        },
        {
          name: 'comment.line.hash.isl',
          match: '#.*$',
        },
      ],
    },
    strings: {
      patterns: [
        {
          name: 'string.quoted.double.isl',
          begin: '"',
          end: '"',
          patterns: [
            {
              name: 'constant.character.escape.isl',
              match: '\\\\.',
            },
          ],
        },
      ],
    },
    keywords: {
      patterns: [
        {
          name: 'keyword.control.isl',
          match: '\\b(intent|pre|post|invariant|scenario|chaos|given|when|then|inject|expect|forall|exists|implies|old|if|else|return|where|for|in)\\b',
        },
        {
          name: 'keyword.declaration.isl',
          match: '\\b(domain|entity|behavior|type|enum|struct|input|output|preconditions|postconditions|invariants|temporal|security|compliance|actors|errors|lifecycle|version|description|scope|always|module|import|export|extends|implements)\\b',
        },
        {
          name: 'keyword.other.isl',
          match: '\\b(success|failure|result|this|self|null|nil|true|false)\\b',
        },
      ],
    },
    types: {
      patterns: [
        {
          name: 'support.type.primitive.isl',
          match: '\\b(String|Number|Int|Integer|Float|Boolean|Bool|UUID|Timestamp|DateTime|Date|Time|Decimal|Email|Password|URL|JSON|Any|void|never)\\b',
        },
        {
          name: 'support.type.collection.isl',
          match: '\\b(Array|List|Set|Map|Object|Optional|Result)\\b',
        },
        {
          name: 'entity.name.type.isl',
          match: '\\b[A-Z][a-zA-Z0-9_]*\\b',
        },
      ],
    },
    modifiers: {
      patterns: [
        {
          name: 'storage.modifier.isl',
          match: '\\[(immutable|unique|indexed|secret|sensitive|default|positive|optional|required|nullable|readonly|private|public|internal)[^\\]]*\\]',
        },
        {
          name: 'storage.modifier.keyword.isl',
          match: '\\b(immutable|unique|indexed|secret|sensitive|optional|required|nullable|readonly|private|public|internal|async|sync)\\b',
        },
      ],
    },
    operators: {
      patterns: [
        {
          name: 'keyword.operator.comparison.isl',
          match: '(==|!=|<=|>=|<|>)',
        },
        {
          name: 'keyword.operator.logical.isl',
          match: '(&&|\\|\\||!)',
        },
        {
          name: 'keyword.operator.arithmetic.isl',
          match: '(\\+|-|\\*|/|%)',
        },
        {
          name: 'keyword.operator.assignment.isl',
          match: '(=|:)',
        },
        {
          name: 'keyword.operator.arrow.isl',
          match: '(->|=>)',
        },
      ],
    },
    numbers: {
      patterns: [
        {
          name: 'constant.numeric.float.isl',
          match: '\\b\\d+\\.\\d+\\b',
        },
        {
          name: 'constant.numeric.integer.isl',
          match: '\\b\\d+\\b',
        },
      ],
    },
    punctuation: {
      patterns: [
        {
          name: 'punctuation.definition.block.isl',
          match: '[{}]',
        },
        {
          name: 'punctuation.definition.parameters.isl',
          match: '[()]',
        },
        {
          name: 'punctuation.definition.array.isl',
          match: '[\\[\\]]',
        },
        {
          name: 'punctuation.separator.isl',
          match: '[,;]',
        },
      ],
    },
  },
};

// Simplified grammar object for Shiki
export const islLanguage = {
  id: 'isl',
  scopeName: 'source.isl',
  grammar: {
    patterns: [
      { include: '#comments' },
      { include: '#strings' },
      { include: '#keywords' },
      { include: '#types' },
      { include: '#modifiers' },
      { include: '#operators' },
      { include: '#numbers' },
    ],
    repository: {
      comments: {
        patterns: [
          { name: 'comment.line.double-slash.isl', match: '//.*$' },
          { name: 'comment.block.isl', begin: '/\\*', end: '\\*/' },
          { name: 'comment.line.hash.isl', match: '#.*$' },
        ],
      },
      strings: {
        patterns: [
          {
            name: 'string.quoted.double.isl',
            begin: '"',
            end: '"',
            patterns: [{ name: 'constant.character.escape.isl', match: '\\\\.' }],
          },
        ],
      },
      keywords: {
        patterns: [
          {
            name: 'keyword.control.isl',
            match: '\\b(intent|pre|post|invariant|scenario|chaos|given|when|then|inject|expect|forall|exists|implies|old|if|else|return|where|for|in)\\b',
          },
          {
            name: 'keyword.declaration.isl',
            match: '\\b(domain|entity|behavior|type|enum|struct|input|output|preconditions|postconditions|invariants|temporal|security|compliance|actors|errors|lifecycle|version|description|scope|always|module|import|export|extends|implements)\\b',
          },
          {
            name: 'keyword.other.isl',
            match: '\\b(success|failure|result|this|self|null|nil|true|false)\\b',
          },
        ],
      },
      types: {
        patterns: [
          {
            name: 'support.type.primitive.isl',
            match: '\\b(String|Number|Int|Integer|Float|Boolean|Bool|UUID|Timestamp|DateTime|Date|Time|Decimal|Email|Password|URL|JSON|Any|void|never)\\b',
          },
          {
            name: 'support.type.collection.isl',
            match: '\\b(Array|List|Set|Map|Object|Optional|Result)\\b',
          },
        ],
      },
      modifiers: {
        patterns: [
          {
            name: 'storage.modifier.isl',
            match: '\\[(immutable|unique|indexed|secret|sensitive|default|positive|optional|required|nullable|readonly|private|public|internal)[^\\]]*\\]',
          },
        ],
      },
      operators: {
        patterns: [
          { name: 'keyword.operator.comparison.isl', match: '(==|!=|<=|>=|<|>)' },
          { name: 'keyword.operator.logical.isl', match: '(&&|\\|\\||!)' },
          { name: 'keyword.operator.arithmetic.isl', match: '(\\+|-|\\*|/|%)' },
        ],
      },
      numbers: {
        patterns: [
          { name: 'constant.numeric.float.isl', match: '\\b\\d+\\.\\d+\\b' },
          { name: 'constant.numeric.integer.isl', match: '\\b\\d+\\b' },
        ],
      },
    },
  },
  aliases: ['isl', 'intent'],
};

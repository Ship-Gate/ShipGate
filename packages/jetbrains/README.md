# ISL JetBrains Plugin

IntelliJ IDEA / WebStorm / PyCharm plugin for Intent Specification Language (ISL).

## Features

### Syntax Highlighting
Full syntax highlighting for ISL files including:
- Keywords (`domain`, `entity`, `behavior`, `type`, `enum`)
- Types (`String`, `Int`, `UUID`, `Timestamp`)
- Annotations (`[immutable]`, `[unique]`, `[indexed]`, `[secret]`)
- Comments, strings, numbers, durations

### Code Completion
Smart completion for:
- Keywords based on context
- Built-in types
- Annotations
- Entity and behavior references

### Error Checking
Real-time validation with:
- Syntax error highlighting
- Semantic warnings (naming conventions, missing fields)
- Quick fixes for common issues

### Navigation
- **Go to Definition**: Navigate to entity/type definitions
- **Find Usages**: Find all references to an entity, behavior, or type
- **Structure View**: Navigate through domains, entities, and behaviors

### Code Generation
- **Generate Types**: TypeScript/Python type definitions
- **Generate Tests**: Test scaffolding (Vitest, Jest, PyTest)
- **Generate Docs**: Markdown documentation
- **Generate OpenAPI**: OpenAPI specification

### Verification
- **Verify Implementation**: Check implementation against spec
- **Quick Verify**: Fast syntax check
- **Chaos Tests**: Run chaos testing scenarios

## Installation

### From JetBrains Marketplace

1. Open Settings/Preferences → Plugins
2. Search for "ISL"
3. Click Install

### Manual Installation

1. Download the plugin from [releases](https://github.com/intentos/intentos/releases)
2. Open Settings/Preferences → Plugins → ⚙️ → Install Plugin from Disk
3. Select the downloaded `.zip` file

### Build from Source

```bash
# Clone the repository
git clone https://github.com/intentos/intentos
cd intentos/packages/jetbrains

# Build the plugin
./gradlew build

# Run in a sandbox IDE
./gradlew runIde

# Package for distribution
./gradlew buildPlugin
```

The built plugin will be in `build/distributions/`.

## Usage

### Creating ISL Files

1. Right-click in Project view
2. New → ISL Specification
3. Enter domain name

### Generate Code

1. Open an ISL file
2. Right-click → ISL Generate → Generate Types/Tests/Docs
3. Or use the Generate menu (Ctrl+N / Cmd+N)

### Verify Implementation

1. Open an ISL file
2. Tools → ISL → Verify Implementation
3. Or press Ctrl+Alt+V / Cmd+Alt+V

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Verify Implementation | Ctrl+Alt+V |
| Check Specification | Ctrl+Alt+C |
| Go to Definition | Ctrl+Click |
| Find Usages | Alt+F7 |
| Structure View | Ctrl+F12 |
| Format Code | Ctrl+Alt+L |

## Configuration

### Color Scheme

Customize syntax highlighting in:
Settings → Editor → Color Scheme → ISL

### ISL CLI Path

The plugin uses the ISL CLI for code generation and verification. Install it with:

```bash
npm install -g @intentos/isl-cli
```

## Requirements

- IntelliJ IDEA 2023.3+ (Community or Ultimate)
- WebStorm 2023.3+
- PyCharm 2023.3+
- Or any other JetBrains IDE 2023.3+

## Development

### Project Structure

```
packages/jetbrains/
├── src/main/kotlin/com/isl/plugin/
│   ├── ISLLanguage.kt           # Language definition
│   ├── ISLFileType.kt           # File type
│   ├── ISLIcons.kt              # Icons
│   ├── lexer/                   # Lexer
│   ├── parser/                  # Parser
│   ├── psi/                     # PSI elements
│   ├── highlighting/            # Syntax highlighting
│   ├── completion/              # Code completion
│   ├── annotator/               # Error checking
│   ├── structure/               # Structure view
│   ├── folding/                 # Code folding
│   ├── findusages/              # Find usages
│   ├── formatting/              # Code formatting
│   └── actions/                 # Actions
├── src/main/resources/
│   ├── META-INF/plugin.xml      # Plugin descriptor
│   └── icons/                   # SVG icons
├── build.gradle.kts
└── README.md
```

### Running Tests

```bash
./gradlew test
```

### Building for Release

```bash
./gradlew buildPlugin
```

## Contributing

Contributions are welcome! Please read our contributing guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

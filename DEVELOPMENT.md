# Development Guide

## Quality Assurance Setup

This project uses a comprehensive quality assurance setup to ensure code consistency and
maintainability.

### Tools Configured

- **Prettier**: Code formatting with Tailwind CSS class sorting
- **ESLint**: Code linting with Next.js best practices
- **TypeScript**: Type checking
- **Husky**: Git hooks management
- **lint-staged**: Run linters on staged files
- **Commitlint**: Conventional commit message validation

### Available Scripts

```bash
# Development
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm start            # Start production server

# Quality Checks
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix ESLint issues automatically
pnpm format           # Format all files with Prettier
pnpm format:check     # Check if files are formatted
pnpm format:fix       # Format and fix lint issues
pnpm typecheck        # Run TypeScript type checking
pnpm quality          # Run all quality checks (format, lint, typecheck)
```

### Pre-commit Hooks

The following happens automatically on every commit:

1. **Prettier** formats staged files
2. **ESLint** fixes staged JavaScript/TypeScript files
3. **Commitlint** validates commit message format

### Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/). Format:

```
<type>: <description>

[optional body]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes
- `build`: Build system changes

**Examples:**

```bash
git commit -m "feat: add user authentication"
git commit -m "fix: resolve dashboard redirect issue"
git commit -m "docs: update API documentation"
```

### VS Code Integration

The project includes VS Code settings for:

- Prettier as default formatter
- Format on save enabled
- ESLint auto-fix on save
- Tailwind CSS IntelliSense
- TypeScript import suggestions

**Recommended Extensions:**

- Prettier - Code formatter
- Tailwind CSS IntelliSense
- TypeScript and JavaScript Language Features
- ESLint
- Path Intellisense

### CI/CD

**GitHub Actions** - Quality checks on every push and PR:

1. Install dependencies
2. Check code formatting
3. Run ESLint
4. Type check with TypeScript
5. Run comprehensive quality checks

**Vercel** - Handles building and deployment:

- Automatic builds on push to main/develop
- Preview deployments for PRs
- Zero-config deployment with optimizations

### Manual Quality Check

Run all quality checks manually:

```bash
pnpm quality
```

This runs:

- Format checking
- Linting
- Type checking

### Troubleshooting

**Pre-commit hook fails:**

```bash
# Fix formatting issues
pnpm format

# Fix lint issues
pnpm lint:fix

# Check types
pnpm typecheck
```

**Commit message rejected:** Ensure your commit message follows the conventional format:

```bash
git commit -m "feat: your feature description"
```

**VS Code not formatting:**

1. Install the Prettier extension
2. Set Prettier as default formatter
3. Enable format on save in settings

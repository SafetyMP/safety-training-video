# Contributing to Safety Training Video Creator

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing.

## Getting Started

1. **Fork the repository** and clone your fork locally
2. **Install dependencies**: `npm install`
3. **Set up environment**: Copy `.env.example` to `.env` and configure your API keys
4. **Run the development server**: `npm run dev`

## Development Workflow

### Running Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests (requires API keys)
npm run test:integration

# Run API route tests only
npm run test:api
```

### Code Style

- TypeScript strict mode is enabled
- Use Zod for runtime validation
- Follow existing patterns for API routes, providers, and components

### Project Structure

```
src/
├── app/
│   ├── api/           # Next.js API routes
│   ├── components/    # React components
│   ├── contexts/      # React contexts (state management)
│   └── hooks/         # Custom React hooks
└── lib/
    ├── providers/     # Image, TTS, Video provider abstractions
    ├── constants.ts   # Configuration constants
    ├── schemas.ts     # Zod validation schemas
    └── types.ts       # TypeScript types
```

## Making Changes

### Adding a New Provider

1. Add the provider implementation to the appropriate file in `src/lib/providers/`
2. Add configuration constants to `src/lib/constants.ts`
3. Update the schema in `src/lib/schemas.ts` if needed
4. Add tests for the new provider
5. Update `.env.example` with any new environment variables
6. Update `README.md` with usage instructions

### Adding a New EHS Topic

1. Add the topic to `src/lib/ehs-reference.ts`
2. Include: keywords, key facts, best practices, common hazards, regulatory refs
3. Add tests in `src/lib/ehs-reference.test.ts`

### Modifying API Routes

1. Ensure Zod validation is used for request bodies
2. Use the `withApiHandler` wrapper for consistent error handling
3. Add or update tests in the corresponding `.test.ts` file

## Pull Request Process

1. **Create a feature branch** from `main`
2. **Make your changes** with clear, focused commits
3. **Run tests** to ensure nothing is broken: `npm test`
4. **Update documentation** if needed (README.md, comments, etc.)
5. **Submit a pull request** with a clear description of changes

### PR Checklist

- [ ] Tests pass (`npm test`)
- [ ] TypeScript compiles without errors
- [ ] New features have tests
- [ ] Documentation is updated
- [ ] No sensitive data (API keys, tokens) committed

## Reporting Issues

When reporting issues, please include:

1. **Description** of the issue
2. **Steps to reproduce**
3. **Expected behavior**
4. **Actual behavior**
5. **Environment** (Node version, OS, browser if applicable)
6. **Error messages** or logs (with sensitive data redacted)

## Security

If you discover a security vulnerability, please do NOT open a public issue. See [SECURITY.md](SECURITY.md) for how to report it responsibly.

## License

By contributing, you agree that your contributions will be licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for the full text. Copyright 2026 Sage Hart.

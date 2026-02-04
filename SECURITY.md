# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you believe you have found a security vulnerability, please report it by emailing the maintainer:

- **Sage Hart** – Use the repository’s **Security** tab → **Advisories** → **Report a vulnerability**, or contact the maintainer directly.

Include:

- Description of the vulnerability and affected components
- Steps to reproduce
- Potential impact and suggested fix (if any)

We will acknowledge receipt and aim to respond within a reasonable time. We may request additional information and will keep you updated on the status of the fix.

## Security Considerations

- **API keys**: Never commit `.env` or any file containing API keys. Use `.env.example` as a template only.
- **Rate limiting**: Consider enabling rate limiting before public deployment (see `AUDIT.md`).
- **Authentication**: This application has no built-in authentication; secure the deployment appropriately for your environment.

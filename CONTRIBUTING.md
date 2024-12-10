# Contributing to [Project Name]

This document provides guidelines and instructions for contributing to the project.


## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/project-name.git
   cd project-name
   ```
3. Create a new branch, be descriptive:
   ```bash
   git checkout -b feature/your-feature-name

   # OR

   git checkout -b bugfix/bug-this-pr-fixes

   # OR

   git checkout -b docs/documenting-something
   ```

## Development Workflow

### Testing

- Implement your feature/changes
- Test any code changes thoroughly
- Make sure your PR contains all the information for any developer to checkout your branch and validate it


### Commit Guidelines (not enforced but nice)

- Your commit message should be under 72 characters
- Your commit message should start with a topic (e.g.: "Docs: ")
- Sign-off your commits with `git commit -sm "Feature: Commit subject under 72 characters."`

## Submitting Changes

1. Push your changes to your fork
2. Submit a pull request towards the `development` branch of this repository
3. Ensure the PR description clearly describes the problem and solution
4. Include the relevant issue number if applicable

### Pull Request Process

1. Update documentation if needed: anyone should be able to checkout your branch and validate the changes
2. Add tests for new features
3. Wait for review
4. Upon approval, if you have write access you can merge your PR

### New version/release (maintainers only)

The branch `main` is always assumed to be stable, and new versions are created from there.
To create a new version of this module:

1. Create a new branch from `main` and name it as the new version (e.g.: `v1.5.5`)
1. Update the `"version"` field in `package.json`
1. Run `npm install` to update `package-lock.json`
1. Validate the above
1. Commit and push these changes
1. Open a PR from this new branch to `main` to align version numbers


## License

By contributing, you agree that your contributions will be licensed under the project's license.

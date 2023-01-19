# Contributing to GuardRails

## Table of Contents

- [Submitting a Pull Request](#submitting-a-pull-request)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Code Style Guide](#code-style-guide)

To get your development setup, install the project and learn how-to use it, make sure you go through to the [README.md](https://github.com/guardrailsio/guardrails-worker/blob/master/README.md).

## Submitting a Pull Request

Good pull requests should remain focused in scope and avoid containing unrelated commits.

Here is a summary of the steps to follow:

1.  Create a new topic branch (off the `develop` branch) to contain your feature, change, or fix:

```bash
$ git checkout -b <topic-branch-name>
```

2.  Make your commits, follow the [Commit message guidelines](#commit-message-guidelines)
3.  Push your topic branch:

```bash
$ git push origin <topic-branch-name>
```

4.  [Open a Pull Request](https://help.github.com/articles/creating-a-pull-request/#creating-the-pull-request) with a clear title and description.

**Tip**: In alignement with our "work in the open" value, open a Pull Request as soon as possible with the `[WIP]` prefix in the title, in order to give visibility and receive feedback and help from the rest of the team.

## Commit Message Guidelines

GuardRails uses [semantic-release](https://github.com/semantic-release/semantic-release) for automated version management and package publishing. For that to work, commitmessages need to be in the right format.

### Atomic commits

If possible, make [atomic commits](https://en.wikipedia.org/wiki/Atomic_commit), which means:

- a commit should contain exactly one self-contained functional change
- a functional change should be contained in exactly one commit
- a commit should not create an inconsistent state (such as test errors, linting errors, partial fix, feature with documentation etc...)

A complex feature can be broken down into multiple commits as long as each one keep a consistent state and consist of a self-contained change.

### Commit message format

Each commit message consists of a **header**, a **body** and a **footer**. The header has a special format that includes a **type**, a **scope** and a **subject**:

```commit
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

The **header** is mandatory and the **scope** of the header is optional.

The **footer** can contain a [closing reference to an issue](https://help.github.com/articles/closing-issues-via-commit-messages).

### Revert

If the commit reverts a previous commit, it should begin with `revert:`, followed by the header of the reverted commit. In the body it should say: `This reverts commit <hash>.`, where the hash is the SHA of the commit being reverted.

### Type

The type must be one of the following:

| Type         | Description                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| **build**    | Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)         |
| **ci**       | Changes to our CI configuration files and scripts (example scopes: Travis, Circle, BrowserStack, SauceLabs) |
| **docs**     | Documentation only changes                                                                                  |
| **feat**     | A new feature                                                                                               |
| **fix**      | A bug fix                                                                                                   |
| **perf**     | A code change that improves performance                                                                     |
| **refactor** | A code change that neither fixes a bug nor adds a feature                                                   |
| **style**    | Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)      |
| **test**     | Adding missing tests or correcting existing tests                                                           |

### Subject

The subject contains succinct description of the change:

- use the imperative, present tense: "change" not "changed" nor "changes"
- don't capitalize first letter
- no dot (.) at the end

### Body

Just as in the **subject**, use the imperative, present tense: "change" not "changed" nor "changes".
The body should include the motivation for the change and contrast this with previous behavior.

### Footer

The footer should contain any information about **Breaking Changes** and is also the place to reference GitHub issues that this commit **Closes**.

**Breaking Changes** should start with the word `BREAKING CHANGE:` with a space or two newlines. The rest of the commit message is then used for this.

### Examples

```commit
`fix(pencil): stop graphite breaking when too much pressure applied`
```

```commit
`feat(pencil): add 'graphiteWidth' option`

Fix #42
```

```commit
perf(pencil): remove graphiteWidth option`

BREAKING CHANGE: The graphiteWidth option has been removed.

The default graphite width of 10mm is always used for performance reasons.
```

## Code Style Guide

We use [Prettier](https://github.com/prettier/prettier) with the following configuration:

```
print_width = 80
tab_width = 2
semi = 'true'
single_quote = 'true'
bracket_spacing = 'true'
jsx_bracket_same_line = 'true'
arrow_parens = 'always'
trailing_comma = 'none'
parser = 'babel'
config_precedence = 'prefer-file'
prose_wrap = 'preserve'
```

You can also run the `npm run format` script.

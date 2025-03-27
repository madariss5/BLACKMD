# Contributing to Blacksky-MD

Thank you for your interest in contributing to Blacksky-MD! Your help is essential for keeping this project great.

## Getting Started

1. **Fork the repository**: Start by forking the repository to your own GitHub account.

2. **Clone the repository**: Clone your fork to your local machine.
   ```bash
   git clone https://github.com/your-username/blacksky-md.git
   cd blacksky-md
   ```

3. **Install dependencies**:
   ```bash
   npm install
   pip install -r requirements.txt
   ```

4. **Create a branch**: Create a new branch for your changes.
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Process

1. **Make your changes**: Implement your feature or bug fix.

2. **Run deployment preparation**: Always test your changes with the deployment preparation script.
   ```bash
   node prepare-for-deployment.js
   ```

3. **Test your changes**: Ensure your changes don't break any existing functionality.
   ```bash
   # Check for syntax errors
   find ./src -name "*.js" -exec node -c {} \;
   ```

4. **Commit your changes**: Use meaningful commit messages.
   ```bash
   git commit -m "feat: add new feature"
   ```

   We follow the [Conventional Commits](https://www.conventionalcommits.org/) standard for commit messages:
   - `feat`: A new feature
   - `fix`: A bug fix
   - `docs`: Documentation only changes
   - `style`: Changes that don't affect the meaning of the code
   - `refactor`: A code change that neither fixes a bug nor adds a feature
   - `test`: Adding missing tests or correcting existing tests
   - `chore`: Changes to the build process or auxiliary tools

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a pull request**: Go to your fork on GitHub and click the "New pull request" button.

## Pull Request Guidelines

- Update the README.md with details of changes to the interface, if applicable.
- The pull request will be merged once reviewed and approved by a maintainer.
- Please ensure that your code follows the project's coding style and naming conventions.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

Thank you for contributing to Blacksky-MD!
/**
 * Project initialization - scaffolds DDX files and folders
 */

import * as fs from 'fs';
import * as path from 'path';
import { FileManager } from './infra/file-manager';

export class InitCommand {
  private fileManager: FileManager;
  private ddxRootDir: string;

  constructor() {
    this.fileManager = new FileManager();
    // Get the DDX installation directory (where this module lives)
    this.ddxRootDir = path.join(__dirname, '..');
  }

  async execute(options: { force?: boolean } = {}): Promise<void> {
    console.log('\nInitializing DDX project...\n');

    const targetDir = process.cwd();
    const toolingDir = path.join(targetDir, '.ddx-tooling');
    const ddxDir = path.join(targetDir, 'ddx');

    // Check if files already exist
    if (!options.force) {
      this.checkExistingFiles(toolingDir);
    }

    // Create .ddx-tooling directory
    this.createDirectory(toolingDir);

    // Copy config file
    this.copyConfigFile(toolingDir, options.force);

    // Copy prompts directory
    this.copyDirectory(
      path.join(this.ddxRootDir, 'prompts'),
      path.join(toolingDir, 'prompts'),
      options.force
    );

    // Copy templates directory
    this.copyDirectory(
      path.join(this.ddxRootDir, 'templates'),
      path.join(toolingDir, 'templates'),
      options.force
    );

    // Create ddx output directory
    this.createDirectory(ddxDir);

    // Create .env.example
    this.createEnvExample(toolingDir, options.force);

    // Update .gitignore
    this.updateGitignore(targetDir);

    console.log('✓ DDX project initialized successfully!\n');
    console.log('Next steps:');
    console.log('  1. Set your API key:');
    console.log('     echo "ANTHROPIC_API_KEY=your_key_here" > .ddx-tooling/.env\n');
    console.log('  2. List available document types:');
    console.log('     ddx list\n');
    console.log('  3. Create your first document:');
    console.log('     ddx create opportunity_brief\n');
  }

  private checkExistingFiles(toolingDir: string): void {
    if (fs.existsSync(toolingDir)) {
      const filesToCheck = [
        'config.yaml',
        'prompts',
        'templates',
      ];

      const existingFiles = filesToCheck.filter((file) =>
        fs.existsSync(path.join(toolingDir, file))
      );

      if (existingFiles.length > 0) {
        throw new Error(
          `DDX files already exist in .ddx-tooling/: ${existingFiles.join(', ')}\n` +
          'Use --force to overwrite existing files.'
        );
      }
    }
  }

  private copyConfigFile(toolingDir: string, force?: boolean): void {
    const sourcePath = path.join(this.ddxRootDir, 'ddx.config.yaml');
    const targetPath = path.join(toolingDir, 'config.yaml');

    if (!force && fs.existsSync(targetPath)) {
      console.log('⊘ Skipping config.yaml (already exists)');
      return;
    }

    if (!fs.existsSync(sourcePath)) {
      throw new Error(
        'DDX config template not found. Please ensure DDX is properly installed.'
      );
    }

    fs.copyFileSync(sourcePath, targetPath);
    console.log('✓ Created config.yaml');
  }

  private copyDirectory(sourceDir: string, targetDir: string, force?: boolean): void {
    const dirName = path.basename(targetDir);

    if (!fs.existsSync(sourceDir)) {
      console.log(`⊘ Skipping ${dirName}/ (source not found)`);
      return;
    }

    if (!force && fs.existsSync(targetDir)) {
      console.log(`⊘ Skipping ${dirName}/ (already exists)`);
      return;
    }

    // Create target directory
    this.fileManager.ensureDirectory(targetDir);

    // Copy all files from source to target
    const files = fs.readdirSync(sourceDir);

    for (const file of files) {
      // Skip hidden files and directories
      if (file.startsWith('.')) {
        continue;
      }

      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);

      const stat = fs.statSync(sourcePath);

      if (stat.isDirectory()) {
        this.copyDirectory(sourcePath, targetPath, force);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }

    console.log(`✓ Created ${dirName}/ directory`);
  }

  private createDirectory(dirPath: string): void {
    const dirName = path.basename(dirPath);

    if (fs.existsSync(dirPath)) {
      console.log(`⊘ Skipping ${dirName}/ (already exists)`);
      return;
    }

    this.fileManager.ensureDirectory(dirPath);
    console.log(`✓ Created ${dirName}/ directory`);
  }

  private createEnvExample(targetDir: string, force?: boolean): void {
    const targetPath = path.join(targetDir, '.env.example');

    if (!force && fs.existsSync(targetPath)) {
      console.log('⊘ Skipping .env.example (already exists)');
      return;
    }

    const content = '# Anthropic API Key\nANTHROPIC_API_KEY=your_api_key_here\n';
    this.fileManager.writeFile(targetPath, content);
    console.log('✓ Created .env.example');
  }

  private updateGitignore(targetDir: string): void {
    const gitignorePath = path.join(targetDir, '.gitignore');

    const entriesToAdd = [
      '.ddx-tooling/.env',
      '.ddx-tooling/.state/',
      'node_modules/',
    ];

    let existingContent = '';
    if (fs.existsSync(gitignorePath)) {
      existingContent = this.fileManager.readFile(gitignorePath);
    }

    const existingLines = new Set(
      existingContent.split('\n').map((line) => line.trim())
    );

    const linesToAdd = entriesToAdd.filter(
      (entry) => !existingLines.has(entry)
    );

    if (linesToAdd.length === 0) {
      console.log('⊘ .gitignore already up to date');
      return;
    }

    let newContent = existingContent;

    if (existingContent && !existingContent.endsWith('\n')) {
      newContent += '\n';
    }

    if (existingContent) {
      newContent += '\n# DDX\n';
    }

    newContent += linesToAdd.join('\n') + '\n';

    this.fileManager.writeFile(gitignorePath, newContent);
    console.log('✓ Updated .gitignore');
  }
}

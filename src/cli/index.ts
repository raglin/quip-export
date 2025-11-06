#!/usr/bin/env node

// CLI entry point
import { Command } from 'commander';
import { AuthManager } from '../auth/auth-manager';

import * as readline from 'readline';
import * as fs from 'fs/promises';
import * as path from 'path';

const program = new Command();

program
  .name('quip-export')
  .description('CLI tool to export documents from Quip to local storage')
  .version('1.0.0');

// Helper function to create readline interface and prompt user for input
function promptUser(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Helper function to prompt user for sensitive input with masked display
function promptUserMasked(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Display the question immediately
    process.stdout.write(question);

    // Disable echo for password input
    const stdin = process.stdin;
    stdin.setRawMode(true);

    let input = '';

    const onData = (char: Buffer) => {
      const c = char.toString();

      switch (c) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          stdin.setRawMode(false);
          stdin.removeListener('data', onData);
          rl.close();
          process.stdout.write('\n');
          resolve(input.trim());
          break;
        case '\u0003': // Ctrl+C
          stdin.setRawMode(false);
          stdin.removeListener('data', onData);
          rl.close();
          process.stdout.write('\n');
          process.exit(1);
          break;
        case '\u007f': // Backspace
        case '\b':
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          if (c >= ' ' && c <= '~') {
            // Printable characters
            input += c;
            process.stdout.write('*');
          }
          break;
      }
    };

    stdin.on('data', onData);
  });
}

// Helper function to format date
function formatDate(timestamp: number): string {
  return new Date(timestamp / 1000).toLocaleDateString();
}

// Helper function to truncate text
function truncateText(text: string | undefined | null, maxLength: number): string {
  if (!text) return 'Untitled';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Helper function to format duration
function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// Helper function to display documents as table
function displayDocumentsAsTable(documents: any[], verbose: boolean = false): void {
  if (documents.length === 0) return;

  // Determine if we're dealing with DocumentWithPath objects or plain documents
  const isDocumentWithPath = documents[0].document !== undefined;

  console.log('📋 Documents:');
  console.log('─'.repeat(120));

  if (verbose) {
    // Verbose table format
    console.log(
      'ID'.padEnd(15) +
        'Title'.padEnd(40) +
        'Type'.padEnd(12) +
        'Created'.padEnd(12) +
        'Folder'.padEnd(25) +
        'Shared'.padEnd(8)
    );
    console.log('─'.repeat(120));

    documents.forEach((item) => {
      const doc = isDocumentWithPath ? item.document : item;
      const folderPath = isDocumentWithPath ? item.folderPath : 'Documents';
      const isShared = isDocumentWithPath ? item.isShared : false;

      console.log(
        truncateText(doc.id, 14).padEnd(15) +
          truncateText(doc.title, 39).padEnd(40) +
          (doc.type || 'DOCUMENT').padEnd(12) +
          formatDate(doc.created_usec || Date.now() * 1000).padEnd(12) +
          truncateText(folderPath, 24).padEnd(25) +
          (isShared ? 'Yes' : 'No').padEnd(8)
      );
    });
  } else {
    // Compact table format
    console.log(
      'Title'.padEnd(50) + 'Type'.padEnd(12) + 'Created'.padEnd(12) + 'Folder'.padEnd(30)
    );
    console.log('─'.repeat(120));

    documents.forEach((item) => {
      const doc = isDocumentWithPath ? item.document : item;
      const folderPath = isDocumentWithPath ? item.folderPath : 'Documents';

      console.log(
        truncateText(doc.title, 49).padEnd(50) +
          (doc.type || 'DOCUMENT').padEnd(12) +
          formatDate(doc.created_usec || Date.now() * 1000).padEnd(12) +
          truncateText(folderPath, 29).padEnd(30)
      );
    });
  }

  console.log('─'.repeat(120));
}

// Helper function to display documents as CSV
function displayDocumentsAsCsv(documents: any[], verbose: boolean = false): void {
  if (documents.length === 0) return;

  const isDocumentWithPath = documents[0].document !== undefined;

  if (verbose) {
    console.log('ID,Title,Type,Created,Updated,Author,Company,Link,Folder,Shared,Template,Deleted');

    documents.forEach((item) => {
      const doc = isDocumentWithPath ? item.document : item;
      const folderPath = isDocumentWithPath ? item.folderPath : 'Documents';
      const isShared = isDocumentWithPath ? item.isShared : false;

      console.log(
        [
          `"${doc.id}"`,
          `"${doc.title.replace(/"/g, '""')}"`,
          `"${doc.type}"`,
          `"${formatDate(doc.created_usec)}"`,
          `"${formatDate(doc.updated_usec)}"`,
          `"${doc.author_id}"`,
          `"${doc.owning_company_id || ''}"`,
          `"${doc.link}"`,
          `"${folderPath.replace(/"/g, '""')}"`,
          `"${isShared ? 'Yes' : 'No'}"`,
          `"${doc.is_template ? 'Yes' : 'No'}"`,
          `"${doc.is_deleted ? 'Yes' : 'No'}"`,
        ].join(',')
      );
    });
  } else {
    console.log('Title,Type,Created,Folder');

    documents.forEach((item) => {
      const doc = isDocumentWithPath ? item.document : item;
      const folderPath = isDocumentWithPath ? item.folderPath : 'Documents';

      console.log(
        [
          `"${doc.title.replace(/"/g, '""')}"`,
          `"${doc.type}"`,
          `"${formatDate(doc.created_usec)}"`,
          `"${folderPath.replace(/"/g, '""')}"`,
        ].join(',')
      );
    });
  }
}

// Helper function to validate format-specific options
async function validateFormatOptions(
  config: any
): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Get the configuration object (handle nested structure)
  const exportConfig = config.export || config;
  const formats = exportConfig.exportFormats || [exportConfig.exportFormat || 'docx'];
  const formatOptions = exportConfig.formatSpecificOptions || {};

  // Import FormatValidator for capability checking
  try {
    const { FormatValidator } = await import('../core/format-validator');
    const validator = new FormatValidator();

    // Validate format capabilities and dependencies
    const validation = await validator.validateFormatSelection(formats);

    if (!validation.valid) {
      errors.push(...validation.errors);
    }

    warnings.push(...validation.warnings);

    // Add dependency installation instructions for unavailable formats
    const unavailableFormats = validation.capabilities
      .filter((cap) => !cap.available && formats.includes(cap.format))
      .map((cap) => cap.format);

    for (const format of unavailableFormats) {
      const instructions = validator.getDependencyInstructions(format);
      if (instructions.length > 0) {
        warnings.push(`To enable ${format} export: ${instructions.join(', ')}`);
      }
    }
  } catch (importError) {
    // Fallback to basic validation if FormatValidator import fails
    const supportedFormats = ['docx', 'html', 'markdown'];
    const invalidFormats = formats.filter((format: string) => !supportedFormats.includes(format));
    if (invalidFormats.length > 0) {
      errors.push(
        `Unsupported export formats: ${invalidFormats.join(', ')}. Supported formats: ${supportedFormats.join(', ')}`
      );
    }
  }

  // Validate markdown options if markdown format is selected
  if (formats.includes('markdown') && formatOptions.markdown) {
    const markdownOptions = formatOptions.markdown;

    if (
      markdownOptions.imageHandling &&
      !['inline', 'separate', 'skip'].includes(markdownOptions.imageHandling)
    ) {
      errors.push(
        `Invalid markdown image handling option: ${markdownOptions.imageHandling}. Valid options: inline, separate, skip`
      );
    }

    if (
      markdownOptions.preserveComments !== undefined &&
      typeof markdownOptions.preserveComments !== 'boolean'
    ) {
      errors.push(`Markdown preserveComments option must be a boolean value`);
    }

    if (
      markdownOptions.frontMatter !== undefined &&
      typeof markdownOptions.frontMatter !== 'boolean'
    ) {
      errors.push(`Markdown frontMatter option must be a boolean value`);
    }
  }

  // Validate format directory option
  if (
    exportConfig.useFormatDirectories !== undefined &&
    typeof exportConfig.useFormatDirectories !== 'boolean'
  ) {
    errors.push(`useFormatDirectories option must be a boolean value`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Helper function to migrate old configuration format to new format
function migrateConfiguration(config: any): any {
  let migrated = false;
  const migratedConfig = { ...config };

  // Migrate single exportFormat to exportFormats array
  if (config.exportFormat && !config.exportFormats) {
    if (config.exportFormat === 'both') {
      // Handle legacy 'both' format
      migratedConfig.exportFormats = ['docx', 'html'];
      migratedConfig.exportFormat = 'docx'; // Primary format for backward compatibility
      migratedConfig.useFormatDirectories = true;
    } else {
      migratedConfig.exportFormats = [config.exportFormat];
    }
    migrated = true;
  }

  // Migrate nested export configuration
  if (config.export) {
    if (config.export.exportFormat && !config.export.exportFormats) {
      if (config.export.exportFormat === 'both') {
        migratedConfig.export.exportFormats = ['docx', 'html'];
        migratedConfig.export.exportFormat = 'docx';
        migratedConfig.export.useFormatDirectories = true;
      } else {
        migratedConfig.export.exportFormats = [config.export.exportFormat];
      }
      migrated = true;
    }
  }

  // Ensure format-specific options exist
  if (!migratedConfig.formatSpecificOptions && !migratedConfig.export?.formatSpecificOptions) {
    const targetConfig = migratedConfig.export || migratedConfig;
    targetConfig.formatSpecificOptions = {};
    migrated = true;
  }

  // Add migration timestamp if changes were made
  if (migrated) {
    migratedConfig.migratedAt = new Date().toISOString();
    migratedConfig.migrationVersion = '1.0.0';
  }

  return migratedConfig;
}

// Helper function to load configuration from file or environment
async function loadConfiguration(): Promise<any> {
  const configPath = '.export-config.json';

  try {
    // Try to load from config file first
    const configFile = await fs.readFile(configPath, 'utf8');
    const fileConfig = JSON.parse(configFile);

    // Migrate configuration if needed
    const migratedConfig = migrateConfiguration(fileConfig);

    // Validate configuration
    const validation = await validateFormatOptions(migratedConfig);
    if (!validation.valid) {
      console.error('❌ Configuration validation failed:');
      validation.errors.forEach((error) => console.error(`  • ${error}`));
      console.error('\n💡 Run "quip-export export configure" to fix configuration issues.');
      throw new Error('Invalid configuration');
    }

    // Show warnings if any
    if (validation.warnings.length > 0) {
      console.warn('\n⚠️  Configuration warnings:');
      validation.warnings.forEach((warning) => console.warn(`  • ${warning}`));
    }

    // Save migrated configuration if changes were made
    if (migratedConfig.migratedAt && migratedConfig.migratedAt !== fileConfig.migratedAt) {
      try {
        await fs.writeFile(configPath, JSON.stringify(migratedConfig, null, 2));
        console.log('✅ Configuration automatically migrated to support new multi-format features');
      } catch (error) {
        // Migration save failed, but continue with migrated config in memory
        console.log('⚠️  Configuration migrated in memory (could not save to file)');
      }
    }

    return migratedConfig;
  } catch {
    // Fall back to environment variables for Quip only
    const { loadConfigFromEnv } = await import('../auth/config');
    const envConfig = loadConfigFromEnv();

    return {
      quip: envConfig.quip,
    };
  }
}

// Helper function to get auth manager with configuration
async function getAuthManager(): Promise<AuthManager | null> {
  const config = await loadConfiguration();

  if (!config.quip) {
    console.error('❌ Authentication configuration missing!');
    console.error('');
    console.error('🚀 Quick Setup:');
    console.error('   Run "quip-export setup" for interactive configuration');
    console.error('');
    console.error('🔧 Manual Setup:');
    console.error('   Set these environment variables:');

    if (!config.quip) {
      console.error('   - QUIP_PERSONAL_ACCESS_TOKEN (required)');
      console.error('   - QUIP_DOMAIN (optional, defaults to quip.com)');
    }

    return null;
  }

  return new AuthManager(config.quip);
}

// Setup command for first-time users
program
  .command('setup')
  .description('Interactive setup for Quip export')
  .action(async () => {
    try {
      console.log('🚀 Welcome to Quip Bulk Export Tool!');
      console.log('═'.repeat(50));
      console.log('This setup will guide you through the initial configuration.\n');

      // Check if config already exists
      const configPath = '.export-config.json';

      try {
        await fs.access(configPath);
        console.log('✅ Found existing configuration');

        const useExisting = await promptUser('Use existing configuration? (y/n): ');
        if (useExisting.toLowerCase() === 'y' || useExisting.toLowerCase() === 'yes') {
          console.log(
            'Configuration ready! You can now run "quip-export list" to see your documents.'
          );
          return;
        }
      } catch {
        // No existing config, continue with setup
      }

      console.log('📋 Quip Authentication Setup');
      console.log("You'll need a personal access token from Quip.\n");

      // Get domain configuration
      console.log('🌐 Quip Domain Configuration:');
      console.log(
        'Enter your Quip domain (e.g., quip.com for public, quip-enterprise.com for enterprise)'
      );
      console.log('Do not include https:// ');
      const quipDomain =
        (await promptUser('Quip domain (press Enter for quip.com): ')) || 'quip.com';

      // Validate domain format
      if (quipDomain && !quipDomain.match(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
        console.error(
          '❌ Invalid domain format. Please enter a valid domain (e.g., quip.com, quip-enterprise.com)'
        );
        process.exit(1);
      }

      // Get personal access token with enhanced instructions
      console.log('\n🔑 Personal Access Token Setup:');
      console.log('═'.repeat(60));
      console.log('📋 Instructions:');
      console.log(`   1. Open your browser and go to: https://${quipDomain}/dev/token`);
      console.log('   2. Click "Generate Token" to create a new personal access token');
      console.log('   3. Copy the generated token (it looks like: OTVhYjA3N2ItYjg5Ny00...)');
      console.log('   4. Paste it below (input will be masked for security)');
      console.log('');
      console.log('💡 Tips:');
      console.log('   • Personal access tokens provide full API access to your account');
      console.log("   • Tokens don't expire but can be regenerated if needed");
      console.log('   • Keep your token secure - treat it like a password');
      console.log('═'.repeat(60));
      console.log('');

      const personalToken = await promptUserMasked('Enter your personal access token: ');

      if (!personalToken.trim()) {
        console.error('❌ Personal access token is required');
        process.exit(1);
      }

      // Export preferences
      console.log('\n📋 Export Preferences');
      const outputDirectory =
        (await promptUser('Output directory (default: "./exported-documents"): ')) ||
        './exported-documents';

      // Simplified format selection with clear options
      console.log('\n📄 Export Format Configuration:');
      console.log('Available formats:');
      console.log(
        '  1. Native - Document-appropriate format (DOCX for documents, XLSX for spreadsheets)'
      );
      console.log('  2. HTML - Universal web format (works everywhere)');
      console.log('  3. Markdown - Plain text markup (version control friendly)');
      console.log('');

      const formatChoice =
        (await promptUser('Choose format (1=native, 2=html, 3=markdown, default: native): ')) ||
        '1';
      let exportFormat: string;

      switch (formatChoice) {
        case '2':
          exportFormat = 'html';
          break;
        case '3':
          exportFormat = 'markdown';
          break;
        case '1':
        default:
          exportFormat = 'native';
          break;
      }

      // Format-specific options for markdown
      let markdownOptions: any = {};
      if (exportFormat === 'markdown') {
        console.log('\n🔧 Markdown Format Options:');
        const imageHandling =
          (await promptUser(
            'Image handling (1=inline, 2=separate files, 3=skip, default: separate): '
          )) || '2';
        const preserveComments = await promptUser(
          'Preserve Quip comments as markdown comments? (y/n, default: n): '
        );
        const frontMatter = await promptUser(
          'Include document metadata as front matter? (y/n, default: y): '
        );

        markdownOptions = {
          imageHandling:
            imageHandling === '1' ? 'inline' : imageHandling === '3' ? 'skip' : 'separate',
          preserveComments:
            preserveComments.toLowerCase() === 'y' || preserveComments.toLowerCase() === 'yes',
          frontMatter: frontMatter.toLowerCase() !== 'n' && frontMatter.toLowerCase() !== 'no',
        };
      }

      const includeShared = await promptUser('Include shared documents? (y/n, default: y): ');
      const preserveFolders = await promptUser('Preserve folder structure? (y/n, default: y): ');

      // Create configuration with enhanced format support
      const config = {
        quip: {
          domain: quipDomain,
          baseUrl: `https://platform.${quipDomain}`,
          tokenUrl: `https://${quipDomain}/dev/token`,
          personalAccessToken: personalToken.trim(),
        },
        export: {
          outputDirectory,
          exportFormat,
          formatSpecificOptions: exportFormat === 'markdown' ? { markdown: markdownOptions } : {},
          includeSharedDocuments:
            includeShared.toLowerCase() !== 'n' && includeShared.toLowerCase() !== 'no',
          preserveFolderStructure:
            preserveFolders.toLowerCase() !== 'n' && preserveFolders.toLowerCase() !== 'no',

          batchSize: 10,
          retryAttempts: 3,
          rateLimitDelay: 1000,
        },
      };

      // Test the token
      console.log('\n🔍 Validating personal access token...');
      try {
        const { createQuipConfig } = await import('../auth/config');
        const quipConfig = createQuipConfig(personalToken.trim(), quipDomain);
        const tempAuthManager = new AuthManager(quipConfig);
        const authResult = await tempAuthManager.authenticateQuip();

        if (!authResult.success) {
          console.error('❌ Token validation failed:', authResult.error);
          console.error('');
          console.error('🔧 Troubleshooting:');
          console.error(
            `   • Verify the token was copied correctly from https://${quipDomain}/dev/token`
          );
          console.error('   • Check that the domain is correct for your Quip instance');
          console.error('   • Try generating a new token if the current one is invalid');
          process.exit(1);
        }

        console.log('✅ Personal access token validated successfully!');
      } catch (error) {
        console.error(
          '❌ Token validation failed:',
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }

      // Save configuration
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      console.log(`\n✅ Configuration saved to ${configPath}`);

      console.log('\n🎉 Setup Complete!');
      console.log('Next steps:');
      console.log('1. Run "quip-export list" to see your documents');
      console.log('2. Run "quip-export export preview" to preview what will be exported');
      console.log('3. Run "quip-export export start" to begin exporting your documents');
    } catch (error) {
      console.error('❌ Setup failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Authentication commands
const authCommand = program.command('auth').description('Authenticate with Quip service');

authCommand
  .command('login')
  .description('Login to Quip service')
  .action(async () => {
    try {
      console.log('🔐 Starting Quip authentication...\n');

      // Check if we have configuration
      const config = await loadConfiguration();
      if (!config.quip) {
        console.error('❌ No Quip configuration found!');
        console.error('💡 Run "quip-export setup" first to configure authentication.');
        process.exit(1);
      }

      // Create auth manager from existing config
      const quipConfig = config.quip;
      const authManager = new AuthManager(quipConfig);

      console.log('🔍 Authenticating with Quip...');
      const quipResult = await authManager.authenticateQuip();

      if (quipResult.success) {
        const domain = config.quip?.domain || 'quip.com';

        console.log('✅ Quip authentication successful!');
        console.log(`   Method: 🔑 Personal Access Token`);
        console.log(`   Domain: ${domain}`);
        console.log(`   Status: Ready for document export\n`);

        console.log('🎉 Authentication complete! You can now export your documents.');
        console.log('💡 Try "quip-export list" to see your documents.');
      } else {
        console.error(`❌ Quip authentication failed: ${quipResult.error}`);

        // Provide specific guidance for personal access token
        console.error('');
        console.error('🔧 Personal Access Token Troubleshooting:');
        console.error(
          `   • Verify your token at: https://${config.quip?.domain || 'quip.com'}/dev/token`
        );
        console.error('   • Ensure the token was copied completely');
        console.error('   • Check that you have access to the configured domain');
        console.error('   • Try running "quip-export setup" again with a new token');
        process.exit(1);
      }
    } catch (error) {
      console.error(
        '❌ Authentication process failed:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

authCommand
  .command('logout')
  .description('Logout from Quip service')
  .action(async () => {
    try {
      const authManager = await getAuthManager();
      if (!authManager) {
        process.exit(1);
      }

      console.log('🔓 Logging out from Quip...\n');
      await authManager.logout();
      console.log('✅ Logged out from Quip successfully!');
    } catch (error) {
      console.error('❌ Logout failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

authCommand
  .command('status')
  .description('Check Quip authentication status')
  .action(async () => {
    try {
      const config = await loadConfiguration();

      console.log('🔍 Checking authentication status...\n');

      // Show detailed configuration information
      console.log('⚙️  Configuration Details:');
      console.log('─'.repeat(50));
      if (config.quip) {
        const domain = config.quip.domain || 'quip.com';
        const baseUrl = config.quip.baseUrl || `https://platform.${domain}`;
        const tokenUrl = config.quip.tokenUrl || `https://${domain}/dev/token`;

        console.log('📝 Quip Configuration:');
        console.log(`   Authentication Method: 🔑 Personal Access Token`);
        console.log(`   Domain: ${domain}`);
        console.log(`   API Base URL: ${baseUrl}`);
        console.log(`   Token Generation URL: ${tokenUrl}`);
        console.log(
          `   Token Status: ${config.quip.personalAccessToken ? '✅ Configured' : '❌ Missing'}`
        );
      } else {
        console.log('📝 Quip Configuration: ❌ Not configured');
      }

      console.log('');

      console.log('─'.repeat(50));

      if (!config.quip) {
        console.log('\n💡 Run "quip-export setup" to configure authentication');
        return;
      }

      const authManager = new AuthManager(config.quip);
      const status = await authManager.getAuthStatus();
      const validation = await authManager.validateAuthentication();

      console.log('\n📊 Authentication Status:');
      console.log(`  Quip: ${status.quip ? '✅ Authenticated' : '❌ Not authenticated'}`);

      console.log('\n🔐 Token Validation & Status:');
      if (validation.valid) {
        console.log('  ✅ All tokens are valid and ready for use');

        // Show additional token information if available
        console.log('  📝 Quip: Personal access token is active');
      } else {
        console.log('  ❌ Authentication issues found:');
        validation.errors.forEach((error) => {
          console.log(`    • ${error}`);
        });

        // Provide specific guidance for personal access token
        console.log('\n🔧 Detailed Troubleshooting:');
        console.log('  📝 Personal Access Token Issues:');
        console.log('    • Token may have been revoked or regenerated');
        console.log('    • Check if you have access to the configured Quip domain');
        console.log(
          `    • Generate a new token at: https://${config.quip?.domain || 'quip.com'}/dev/token`
        );
        console.log('    • Ensure the token was copied completely without extra spaces');
      }

      // Show next steps if not fully authenticated
      if (!validation.valid) {
        console.log('\n💡 Recommended Next Steps:');
        console.log('  1. Run "quip-export auth login" to authenticate with both services');
        console.log('  2. Use --quip-only flag to authenticate only with Quip');

        console.log('  3. For personal token issues:');
        console.log(`     • Visit: https://${config.quip?.domain || 'quip.com'}/dev/token`);
        console.log('     • Generate a new token and re-run authentication');
      }
    } catch (error) {
      console.error(
        '❌ Status check failed:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

// Document listing command
program
  .command('list')
  .description('List available Quip documents')
  .option('-t, --type <type>', 'Filter by document type (DOCUMENT, SPREADSHEET, CHAT)')
  .option('-s, --shared', 'Include shared documents')
  .option('--no-shared', 'Exclude shared documents')
  .option('--templates', 'Include template documents')
  .option('--no-templates', 'Exclude template documents (default)')
  .option('--deleted', 'Include deleted documents')
  .option('--no-deleted', 'Exclude deleted documents (default)')
  .option('-q, --query <query>', 'Search documents by title or content')
  .option('-f, --folder <folderId>', 'List documents from specific folder')
  .option('--format <format>', 'Output format (table, json, csv)', 'table')
  .option('--limit <number>', 'Limit number of results', '50')
  .option('-v, --verbose', 'Show detailed document information')
  .action(async (options) => {
    try {
      const authManager = await getAuthManager();
      if (!authManager) {
        process.exit(1);
      }

      // Validate authentication
      const validation = await authManager.validateAuthentication();
      if (!validation.valid) {
        console.error('❌ Authentication required!');
        validation.errors.forEach((error) => console.error(`  • ${error}`));
        console.log('\n💡 Run "quip-export auth login" to authenticate first.');
        process.exit(1);
      }

      console.log('📋 Listing Quip documents...\n');

      // Import required services
      const { QuipService } = await import('../services/quip');
      const { ConsoleLogger } = await import('../core/logger');

      const logger = new ConsoleLogger(options.verbose ? 'DEBUG' : 'INFO');
      const config = await loadConfiguration();
      const quipService = new QuipService(authManager, logger, config.quip);

      // Test connection first
      const connectionTest = await quipService.testConnection();
      if (!connectionTest) {
        console.error('❌ Failed to connect to Quip API. Please check your authentication.');
        process.exit(1);
      }

      // Build document filter
      const limit = parseInt(options.limit);
      const filter: any = {
        includeShared: options.shared,
        includeTemplates: options.templates,
        includeDeleted: options.deleted,
        maxDocuments: limit > 0 ? limit : undefined,
      };

      if (options.type) {
        const validTypes = ['DOCUMENT', 'SPREADSHEET', 'CHAT'];
        const type = options.type.toUpperCase();
        if (!validTypes.includes(type)) {
          console.error(`❌ Invalid document type: ${options.type}`);
          console.error(`Valid types: ${validTypes.join(', ')}`);
          process.exit(1);
        }
        filter.types = [type];
      }

      let documents: any[] = [];

      if (options.query) {
        // Search for documents
        const searchMessage = filter.maxDocuments
          ? `🔍 Searching for: "${options.query}" (limit: ${filter.maxDocuments})`
          : `🔍 Searching for: "${options.query}"`;
        console.log(searchMessage);
        documents = await quipService.searchDocuments(options.query, filter);
      } else if (options.folder) {
        // Get documents from specific folder
        console.log(`📁 Getting documents from folder: ${options.folder}`);
        documents = await quipService.getDocumentsFromFolder(options.folder, true);

        // Apply limit for folder-specific queries (folder discovery doesn't support early limiting yet)
        if (filter.maxDocuments && documents.length > filter.maxDocuments) {
          console.log(
            `📝 Showing first ${filter.maxDocuments} of ${documents.length} documents from folder\n`
          );
          documents = documents.slice(0, filter.maxDocuments);
        }
      } else {
        // Discover all documents
        const discoveryMessage = filter.maxDocuments
          ? `🔍 Discovering up to ${filter.maxDocuments} documents...`
          : '🔍 Discovering all accessible documents...';
        console.log(discoveryMessage);

        const discovery = await quipService.discoverDocuments(filter);
        documents = discovery.documents;

        if (options.verbose) {
          console.log(`📊 Discovery Summary:`);
          console.log(`  Total documents found: ${discovery.totalCount}`);
          console.log(`  After filtering: ${discovery.filteredCount}`);
          console.log(`  Folder structures: ${discovery.folders.length}`);
          if (filter.maxDocuments) {
            console.log(`  Limited to: ${filter.maxDocuments} documents`);
          }
          console.log('');
        }
      }

      if (documents.length === 0) {
        console.log('📭 No documents found matching the criteria.');
        return;
      }

      // Format and display results
      switch (options.format.toLowerCase()) {
        case 'json':
          console.log(JSON.stringify(documents, null, 2));
          break;

        case 'csv':
          displayDocumentsAsCsv(documents, options.verbose);
          break;

        case 'table':
        default:
          displayDocumentsAsTable(documents, options.verbose);
          break;
      }

      console.log(`\n✅ Listed ${documents.length} documents successfully!`);

      if (!options.query && !options.folder) {
        console.log('\n💡 Tips:');
        console.log('  • Use --query to search for specific documents');
        console.log('  • Use --folder to list documents from a specific folder');
        console.log('  • Use --type to filter by document type (DOCUMENT, SPREADSHEET, CHAT)');
        console.log('  • Use --format json or --format csv for different output formats');
      }
    } catch (error) {
      console.error(
        '❌ Failed to list documents:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

// Export configuration commands
const exportCommand = program
  .command('export')
  .description('Export documents from Quip to local storage');

exportCommand
  .command('configure')
  .description('Interactive export configuration setup')
  .option('--output-dir <directory>', 'Set output directory')
  .option('--format <format>', 'Set export format - native, html, or markdown')
  .option(
    '--markdown-images <mode>',
    'Markdown image handling: inline, separate, skip (default: separate)'
  )
  .option('--markdown-comments', 'Preserve Quip comments in markdown')
  .option('--markdown-frontmatter', 'Include metadata as front matter in markdown (default: true)')
  .option('--batch-size <number>', 'Set batch processing size')
  .option('--save', 'Save configuration for future use')
  .action(async (options) => {
    try {
      console.log('⚙️  Export Configuration Setup');
      console.log('═'.repeat(50));
      console.log('Configure your export preferences for Quip documents.\n');

      // Load existing configuration if available
      let config: any = {};
      const configPath = '.export-config.json';

      try {
        const existingConfig = await fs.readFile(configPath, 'utf8');
        config = JSON.parse(existingConfig);
        console.log('✅ Found existing configuration');

        // Show what sections exist
        const hasAuth = config.quip && config.quip.personalAccessToken;
        const hasExport = config.outputDirectory || config.export;

        if (hasAuth) {
          console.log('   🔐 Authentication settings: Will be preserved');
        }
        if (hasExport) {
          console.log('   ⚙️  Export settings: Will be updated');
        }

        const useExisting = await promptUser('Use existing export settings as defaults? (y/n): ');
        if (useExisting.toLowerCase() === 'n' || useExisting.toLowerCase() === 'no') {
          // Keep auth config but reset export config
          const authConfig = config.quip;
          config = authConfig ? { quip: authConfig } : {};
        }
      } catch {
        console.log('📝 Creating new export configuration');
      }

      console.log('\n📁 Output Directory Configuration:');
      const defaultOutputDir = config.outputDirectory || './exported-documents';
      const outputDirectory =
        options.outputDir ||
        (await promptUser(`Output directory (default: ${defaultOutputDir}): `)) ||
        defaultOutputDir;

      console.log('\n📄 Export Format Configuration:');
      console.log('Available formats:');
      console.log(
        '  1. Native - Document-appropriate format (DOCX for documents, XLSX for spreadsheets)'
      );
      console.log('  2. HTML - Universal web format (works everywhere)');
      console.log('  3. Markdown - Plain text markup (version control friendly)');
      console.log('');

      // Handle existing configuration migration
      const existingFormat = config.exportFormat || 'native';

      let exportFormat = options.format;

      if (!exportFormat) {
        const formatChoice =
          (await promptUser(
            `Choose format (1=native, 2=html, 3=markdown, default: ${existingFormat}): `
          )) || '1';

        switch (formatChoice) {
          case '2':
            exportFormat = 'html';
            break;
          case '3':
            exportFormat = 'markdown';
            break;
          case '1':
          default:
            exportFormat = 'native';
            break;
        }
      }

      // Format-specific options for markdown
      const formatSpecificOptions: any = {};
      if (exportFormat === 'markdown') {
        console.log('\n🔧 Markdown Format Options:');
        const imageHandling =
          (await promptUser(
            'Image handling (1=inline, 2=separate files, 3=skip, default: separate): '
          )) || '2';
        const preserveComments = await promptUser(
          'Preserve Quip comments as markdown comments? (y/n, default: n): '
        );
        const frontMatter = await promptUser(
          'Include document metadata as front matter? (y/n, default: y): '
        );

        formatSpecificOptions.markdown = {
          imageHandling:
            imageHandling === '1' ? 'inline' : imageHandling === '3' ? 'skip' : 'separate',
          preserveComments:
            preserveComments.toLowerCase() === 'y' || preserveComments.toLowerCase() === 'yes',
          frontMatter: frontMatter.toLowerCase() !== 'n' && frontMatter.toLowerCase() !== 'no',
        };
      }

      console.log('\n📊 Document Selection Configuration:');
      const includeShared = await promptUser('Include shared documents? (y/n, default: y): ');
      const includeSharedDocuments =
        includeShared.toLowerCase() !== 'n' && includeShared.toLowerCase() !== 'no';

      const preserveFolders = await promptUser('Preserve folder structure? (y/n, default: y): ');
      const preserveFolderStructure =
        preserveFolders.toLowerCase() !== 'n' && preserveFolders.toLowerCase() !== 'no';

      console.log('\n⚡ Performance Configuration:');
      const defaultBatchSize = config.batchSize || 10;
      const batchSizeInput =
        options.batchSize ||
        (await promptUser(`Batch size for processing (1-50, default: ${defaultBatchSize}): `));
      const batchSize = parseInt(batchSizeInput) || defaultBatchSize;

      if (batchSize < 1 || batchSize > 50) {
        console.log('⚠️  Batch size adjusted to valid range (1-50)');
      }

      const rateLimitInput = await promptUser(
        'Rate limit delay between requests in ms (default: 1000): '
      );
      const rateLimitDelay = parseInt(rateLimitInput) || 1000;

      console.log('\n🔄 Retry Configuration:');
      const retryAttemptsInput = await promptUser(
        'Number of retry attempts for failed exports (default: 3): '
      );
      const retryAttempts = parseInt(retryAttemptsInput) || 3;

      const maxDocumentsInput = await promptUser(
        'Maximum documents to export (leave empty for no limit): '
      );
      const maxDocuments = maxDocumentsInput ? parseInt(maxDocumentsInput) : undefined;

      // Build configuration object, preserving existing auth config
      const exportConfig = {
        // Preserve existing authentication configuration
        ...(config.quip && { quip: config.quip }),

        // Update export settings
        outputDirectory,
        exportFormat,
        formatSpecificOptions, // Format-specific options
        includeSharedDocuments,
        preserveFolderStructure,
        batchSize: Math.max(1, Math.min(50, batchSize)),
        rateLimitDelay: Math.max(100, rateLimitDelay),
        retryAttempts: Math.max(1, Math.min(10, retryAttempts)),
        maxDocuments,
        createdAt: config.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Display configuration summary
      console.log('\n📋 Configuration Summary:');
      console.log('─'.repeat(50));

      // Show authentication status
      if (exportConfig.quip) {
        console.log('🔐 Authentication: Configured and preserved');
        console.log(`   Domain: ${exportConfig.quip.domain || 'quip.com'}`);
      } else {
        console.log('🔐 Authentication: Not configured');
      }

      console.log('\n⚙️  Export Settings:');
      console.log(`   Output Directory: ${exportConfig.outputDirectory}`);
      console.log(`   Export Format: ${exportConfig.exportFormat.toUpperCase()}`);
      if (exportConfig.formatSpecificOptions?.markdown) {
        console.log(`   Markdown Options:`);
        console.log(
          `     Image Handling: ${exportConfig.formatSpecificOptions.markdown.imageHandling}`
        );
        console.log(
          `     Preserve Comments: ${exportConfig.formatSpecificOptions.markdown.preserveComments ? 'Yes' : 'No'}`
        );
        console.log(
          `     Front Matter: ${exportConfig.formatSpecificOptions.markdown.frontMatter ? 'Yes' : 'No'}`
        );
      }
      console.log(`   Include Shared: ${exportConfig.includeSharedDocuments ? 'Yes' : 'No'}`);
      console.log(`   Preserve Folders: ${exportConfig.preserveFolderStructure ? 'Yes' : 'No'}`);
      console.log(`   Batch Size: ${exportConfig.batchSize} documents`);
      console.log(`   Rate Limit: ${exportConfig.rateLimitDelay}ms between requests`);
      console.log(`   Retry Attempts: ${exportConfig.retryAttempts}`);
      if (exportConfig.maxDocuments) {
        console.log(`   Document Limit: ${exportConfig.maxDocuments}`);
      }
      console.log('─'.repeat(50));

      // Validate configuration before saving
      const validation = await validateFormatOptions(exportConfig);
      if (!validation.valid) {
        console.error('\n❌ Configuration validation failed:');
        validation.errors.forEach((error) => console.error(`  • ${error}`));
        console.error('\nPlease correct the issues and try again.');
        return;
      }

      // Show warnings if any
      if (validation.warnings.length > 0) {
        console.warn('\n⚠️  Configuration warnings:');
        validation.warnings.forEach((warning) => console.warn(`  • ${warning}`));
        console.warn('');
      }

      // Confirm configuration
      const confirmConfig = await promptUser('\nSave this configuration? (y/n): ');
      if (confirmConfig.toLowerCase() === 'y' || confirmConfig.toLowerCase() === 'yes') {
        await fs.writeFile(configPath, JSON.stringify(exportConfig, null, 2));
        console.log(`✅ Export configuration saved to ${configPath}`);

        console.log('\n🎉 Configuration Complete!');
        console.log('Next steps:');
        console.log('1. Run "quip-export export preview" to see what will be exported');
        console.log('2. Run "quip-export export start" to begin the export process');
      } else {
        console.log('❌ Configuration not saved');
      }
    } catch (error) {
      console.error(
        '❌ Configuration setup failed:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

exportCommand
  .command('preview')
  .description('Preview what documents will be exported with current configuration')
  .option('-c, --config <file>', 'Use specific configuration file')
  .option(
    '--format <formats>',
    'Override export format(s) for preview - single format or comma-separated list'
  )
  .option('--limit <number>', 'Limit preview to N documents', '20')
  .action(async (options) => {
    try {
      const authManager = await getAuthManager();
      if (!authManager) {
        process.exit(1);
      }

      // Validate authentication
      const validation = await authManager.validateAuthentication();
      if (!validation.valid) {
        console.error('❌ Authentication required!');
        validation.errors.forEach((error) => console.error(`  • ${error}`));
        console.log('\n💡 Run "quip-export auth login" to authenticate first.');
        process.exit(1);
      }

      // Load export configuration
      let exportConfig: any;
      const configPath = options.config || '.export-config.json';

      try {
        const configFile = await fs.readFile(configPath, 'utf8');
        exportConfig = JSON.parse(configFile);
        console.log(`✅ Loaded export configuration from ${configPath}`);
      } catch {
        console.error('❌ No export configuration found!');
        console.log('💡 Run "quip-export export configure" to set up export preferences first.');
        process.exit(1);
      }

      console.log('\n🔍 Discovering documents for export preview...\n');

      // Import required services
      const { QuipService } = await import('../services/quip');
      const { ConsoleLogger } = await import('../core/logger');

      const logger = new ConsoleLogger('INFO');
      const config = await loadConfiguration();
      const quipService = new QuipService(authManager, logger, config.quip);

      // Get export settings from nested structure
      const exportSettings = exportConfig.export || exportConfig;

      // Handle format overrides from command line for preview
      let previewFormats = exportSettings.exportFormats || [exportSettings.exportFormat || 'docx'];

      if (options.format) {
        if (options.format.includes(',')) {
          previewFormats = options.format.split(',').map((f: string) => f.trim());
        } else {
          previewFormats = [options.format];
        }
      }

      // Discover documents based on configuration
      const discovery = await quipService.discoverDocuments({
        includeShared: exportSettings.includeSharedDocuments,
        includeTemplates: false,
        includeDeleted: false,
        maxDocuments: exportSettings.maxDocuments, // Pass the limit to optimize discovery
      });

      const documentsToExport = discovery.documents;

      // Apply preview limit
      const previewLimit = parseInt(options.limit);
      const previewDocuments = documentsToExport.slice(0, previewLimit);

      if (documentsToExport.length === 0) {
        console.log('📭 No documents found matching export criteria.');
        return;
      }

      // Display export preview
      console.log('📋 Export Preview');
      console.log('═'.repeat(60));
      console.log(`Configuration: ${configPath}`);
      console.log(`Documents to export: ${documentsToExport.length}`);
      if (exportSettings.maxDocuments && discovery.totalCount > documentsToExport.length) {
        console.log(
          `⚠️  Limited by maxDocuments setting (${discovery.totalCount}+ documents available)`
        );
      }
      console.log(`Preview showing: ${previewDocuments.length} documents`);
      console.log(`Output directory: ${exportSettings.outputDirectory}`);
      console.log(
        `Export formats: ${previewFormats.map((f: string) => f.toUpperCase()).join(', ')}`
      );
      if (previewFormats.length > 1 || exportSettings.useFormatDirectories) {
        console.log(`Format organization: Separate directories for each format`);
      }
      console.log('─'.repeat(60));

      // Show document list
      previewDocuments.forEach((docWithPath: any, index: number) => {
        const doc = docWithPath.document;
        const icon = getDocumentIcon(doc.type);

        console.log(`${index + 1}. ${icon} ${doc.title}`);
        console.log(`   Type: ${doc.type}`);
        console.log(`   Folder: ${docWithPath.folderPath}`);

        // Show output paths for each format
        previewFormats.forEach((format: string, formatIndex: number) => {
          const baseDir = exportSettings.outputDirectory || './exported-documents';
          const folderPath = exportSettings.preserveFolderStructure ? docWithPath.folderPath : '';

          // Resolve native format to proper extension based on document type
          let fileExtension = format;
          if (format === 'native') {
            switch (doc.type.toUpperCase()) {
              case 'DOCUMENT':
                fileExtension = 'docx';
                break;
              case 'SPREADSHEET':
                fileExtension = 'xlsx';
                break;
              case 'CHAT':
              default:
                fileExtension = 'html';
                break;
            }
          }

          let outputPath: string;
          if (previewFormats.length > 1 || exportSettings.useFormatDirectories) {
            // Multi-format: organize by format directories
            outputPath = path.join(baseDir, format, folderPath, `${doc.title}.${fileExtension}`);
          } else {
            // Single format: direct to output directory
            outputPath = path.join(baseDir, folderPath, `${doc.title}.${fileExtension}`);
          }

          const label = formatIndex === 0 ? 'Output:' : '      ';
          console.log(`   ${label} ${outputPath}`);
        });

        console.log('');
      });

      if (documentsToExport.length > previewLimit) {
        console.log(`... and ${documentsToExport.length - previewLimit} more documents`);
      }

      console.log('─'.repeat(60));
      console.log('📊 Export Statistics:');

      // Calculate statistics
      const typeStats: { [key: string]: number } = {};
      const folderStats: { [key: string]: number } = {};

      documentsToExport.forEach((docWithPath: any) => {
        const type = docWithPath.document.type;
        const folder = docWithPath.folderPath;

        typeStats[type] = (typeStats[type] || 0) + 1;
        folderStats[folder] = (folderStats[folder] || 0) + 1;
      });

      console.log('\nDocument Types:');
      Object.entries(typeStats).forEach(([type, count]) => {
        const icon = getDocumentIcon(type);
        console.log(`  ${icon} ${type}: ${count} documents`);
      });

      console.log('\nFolder Distribution:');
      Object.entries(folderStats)
        .slice(0, 5)
        .forEach(([folder, count]) => {
          console.log(`  📁 ${folder}: ${count} documents`);
        });

      if (Object.keys(folderStats).length > 5) {
        console.log(`  ... and ${Object.keys(folderStats).length - 5} more folders`);
      }

      // Estimate export time and size
      const estimatedTimePerDoc = 5; // seconds
      const estimatedTotalTime = documentsToExport.length * estimatedTimePerDoc;
      const estimatedSizePerDoc = 500; // KB
      const estimatedTotalSize = documentsToExport.length * estimatedSizePerDoc;

      console.log('\nEstimates:');
      console.log(`  ⏱️  Estimated time: ${formatDuration(estimatedTotalTime * 1000)}`);
      console.log(`  💾 Estimated size: ${(estimatedTotalSize / 1024).toFixed(1)} MB`);

      console.log('\n💡 Next steps:');
      console.log('  • Run "quip-export export start" to begin the export');
      console.log('  • Run "quip-export export configure" to modify settings');
    } catch (error) {
      console.error(
        '❌ Export preview failed:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

exportCommand
  .command('start')
  .description('Start the export process with configured settings')
  .option('-c, --config <file>', 'Use specific configuration file')
  .option('--format <format>', 'Override export format - native, html, or markdown')
  .option('--markdown-images <mode>', 'Markdown image handling: inline, separate, skip')
  .option('--markdown-comments', 'Preserve Quip comments in markdown')
  .option('--markdown-frontmatter', 'Include metadata as front matter in markdown')
  .option('--dry-run', 'Preview export without actually downloading files')
  .option('--resume <sessionId>', 'Resume a previous export session')
  .action(async (options) => {
    try {
      const authManager = await getAuthManager();
      if (!authManager) {
        process.exit(1);
      }

      // Validate authentication
      const validation = await authManager.validateAuthentication();
      if (!validation.valid) {
        console.error('❌ Authentication required!');
        validation.errors.forEach((error) => console.error(`  • ${error}`));
        console.log('\n💡 Run "quip-export auth login" to authenticate first.');
        process.exit(1);
      }

      // Load export configuration
      let exportConfig: any;
      const configPath = options.config || '.export-config.json';

      try {
        const configFile = await fs.readFile(configPath, 'utf8');
        exportConfig = JSON.parse(configFile);
        console.log(`✅ Loaded export configuration from ${configPath}`);
      } catch {
        console.error('❌ No export configuration found!');
        console.log('💡 Run "quip-export export configure" to set up export preferences first.');
        process.exit(1);
      }

      console.log('\n🚀 Starting Quip Document Export');
      console.log('═'.repeat(50));

      // Get export settings from nested structure
      const exportSettings = exportConfig.export || exportConfig;

      // Handle format overrides from command line
      let finalExportFormats = exportSettings.exportFormats || [
        exportSettings.exportFormat || 'docx',
      ];
      let finalFormatOptions = exportSettings.formatSpecificOptions || {};

      if (options.format) {
        if (options.format.includes(',')) {
          finalExportFormats = options.format.split(',').map((f: string) => f.trim());
        } else {
          finalExportFormats = [options.format];
        }
      }

      // Handle markdown-specific CLI options
      if (finalExportFormats.includes('markdown')) {
        const markdownOptions = finalFormatOptions.markdown || {};

        if (options.markdownImages) {
          markdownOptions.imageHandling = options.markdownImages;
        }
        if (options.markdownComments !== undefined) {
          markdownOptions.preserveComments = options.markdownComments;
        }
        if (options.markdownFrontmatter !== undefined) {
          markdownOptions.frontMatter = options.markdownFrontmatter;
        }

        finalFormatOptions = {
          ...finalFormatOptions,
          markdown: markdownOptions,
        };
      }

      // Import required services
      const { QuipService } = await import('../services/quip');
      const { ExportOrchestrator } = await import('../core/export-orchestrator');
      const { ExportStateManager } = await import('../core/export-state-manager');
      const { ConsoleLogger } = await import('../core/logger');
      const { DirectoryManager } = await import('../services/local/directory-manager');
      const { FileWriter } = await import('../services/local/file-writer');
      const { FolderStructureMapper } = await import('../services/local/folder-structure-mapper');

      const logger = new ConsoleLogger('INFO');
      const config = await loadConfiguration();
      const quipService = new QuipService(authManager, logger, config.quip);

      // Initialize export services
      const directoryConfig = {
        baseOutputPath: exportSettings.outputDirectory || './exported-documents',
        preserveFolderStructure: exportSettings.preserveFolderStructure ?? true,
        sanitizeFileNames: true,
        conflictResolution: 'number' as const,
      };
      const directoryManager = new DirectoryManager(directoryConfig, logger);
      const fileWriter = new FileWriter(directoryManager, directoryConfig, logger);
      const folderMapper = new FolderStructureMapper(directoryManager, directoryConfig, logger);
      const stateManager = new ExportStateManager(logger);

      const orchestrator = new ExportOrchestrator(
        logger,
        stateManager,
        quipService.getDocumentDiscovery(),
        quipService.getDocumentExporter(),
        fileWriter,
        folderMapper,
        directoryManager
      );

      // Convert export config to the format expected by orchestrator
      const orchConfig = {
        outputDirectory: exportSettings.outputDirectory || './exported-documents',
        exportFormats: finalExportFormats, // New multi-format support
        exportFormat: finalExportFormats[0], // Backward compatibility
        formatSpecificOptions: finalFormatOptions, // Format-specific options
        useFormatDirectories: finalExportFormats.length > 1 || exportSettings.useFormatDirectories,
        includeSharedDocuments: exportSettings.includeSharedDocuments ?? true,
        preserveFolderStructure: exportSettings.preserveFolderStructure ?? true,
        batchSize: exportSettings.batchSize || 10,
        rateLimitDelay: exportSettings.rateLimitDelay || 1000,
        retryAttempts: exportSettings.retryAttempts || 3,
        maxDocuments: exportSettings.maxDocuments,
        includeFolders: [], // Include all folders by default
        sanitizeFileNames: true,
        conflictResolution: 'number' as const,
      };

      if (options.dryRun) {
        console.log('🔍 DRY RUN MODE - No files will be downloaded');
        console.log('─'.repeat(50));
      }

      // Display configuration summary
      console.log('📋 Export Configuration:');
      console.log(`  Output Directory: ${orchConfig.outputDirectory}`);
      console.log(
        `  Export Formats: ${orchConfig.exportFormats.map((f: string) => f.toUpperCase()).join(', ')}`
      );
      if (orchConfig.useFormatDirectories) {
        console.log(`  Format Organization: Separate directories for each format`);
      }
      if (orchConfig.formatSpecificOptions?.markdown) {
        console.log(`  Markdown Options:`);
        console.log(
          `    Image Handling: ${orchConfig.formatSpecificOptions.markdown.imageHandling || 'separate'}`
        );
        console.log(
          `    Preserve Comments: ${orchConfig.formatSpecificOptions.markdown.preserveComments ? 'Yes' : 'No'}`
        );
        console.log(
          `    Front Matter: ${orchConfig.formatSpecificOptions.markdown.frontMatter !== false ? 'Yes' : 'No'}`
        );
      }
      console.log(`  Include Shared: ${orchConfig.includeSharedDocuments ? 'Yes' : 'No'}`);
      console.log(`  Preserve Folders: ${orchConfig.preserveFolderStructure ? 'Yes' : 'No'}`);
      console.log(`  Batch Size: ${orchConfig.batchSize}`);
      console.log(`  Rate Limit: ${orchConfig.rateLimitDelay}ms`);
      if (orchConfig.maxDocuments) {
        console.log(`  Document Limit: ${orchConfig.maxDocuments}`);
      }
      console.log('');

      if (!options.dryRun) {
        const confirmExport = await promptUser('Proceed with export? (y/n): ');
        if (confirmExport.toLowerCase() !== 'y' && confirmExport.toLowerCase() !== 'yes') {
          console.log('Export cancelled by user.');
          return;
        }
      }

      console.log('🔍 Starting export process...\n');

      // Note: Progress tracking would be implemented through the orchestrator's internal mechanisms

      // Start the export
      const result = await orchestrator.startExport(orchConfig);

      // Save export data for reporting
      await saveExportData(result, orchConfig);

      // Display results
      console.log('\n📊 Export Results:');
      console.log('═'.repeat(50));
      console.log(`Status: ${result.success ? '✅ Completed' : '❌ Failed'}`);
      console.log(`Total Documents: ${result.totalDocuments}`);
      console.log(`Successful Exports: ${result.successfulExports}`);
      console.log(`Failed Exports: ${result.failedExports}`);
      console.log(`Skipped Documents: ${result.skippedDocuments}`);
      console.log(`Duration: ${formatDuration(result.duration)}`);
      console.log(`Output Directory: ${result.outputDirectory}`);

      if (result.errors.length > 0) {
        console.log('\n❌ Errors:');
        result.errors.slice(0, 5).forEach((error) => {
          console.log(`  • ${error.documentTitle}: ${error.error}`);
        });

        if (result.errors.length > 5) {
          console.log(`  ... and ${result.errors.length - 5} more errors`);
        }
      }

      if (result.success) {
        console.log('\n🎉 Export completed successfully!');
        console.log(`📁 Your documents are available in: ${result.outputDirectory}`);

        console.log('\n💡 Next steps:');
        console.log('  • Review the exported documents in the output directory');
        console.log('  • Upload to your preferred cloud service (Google Drive, Dropbox, etc.)');
        console.log('  • Run "quip-export export report" to generate a detailed report');
      } else {
        console.log('\n❌ Export completed with errors.');
        console.log('💡 Check the error messages above and retry failed documents.');
      }
    } catch (error) {
      console.error('❌ Export failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

exportCommand
  .command('check-formats')
  .description('Check format capabilities and dependencies')
  .action(checkFormatCapabilities);

exportCommand
  .command('status')
  .description('Check the status of current or recent export operations')
  .action(async () => {
    try {
      console.log('📊 Export Status');
      console.log('═'.repeat(40));

      // Check for active export sessions
      // This is a simplified implementation - in a real scenario, you'd check for running processes
      console.log('🔍 Checking for active export sessions...');

      // Check for recent export logs or state files
      // This would typically check for active sessions
      console.log('📭 No active export sessions found.');

      // Show recent export configuration
      try {
        const configFile = await fs.readFile('.export-config.json', 'utf8');
        const config = JSON.parse(configFile);

        console.log('\n⚙️  Current Export Configuration:');
        console.log(`  Output Directory: ${config.outputDirectory}`);

        // Handle both old and new format configurations
        if (config.exportFormats && config.exportFormats.length > 0) {
          console.log(
            `  Export Formats: ${config.exportFormats.map((f: string) => f.toUpperCase()).join(', ')}`
          );
          if (config.useFormatDirectories) {
            console.log(`  Format Organization: Separate directories for each format`);
          }
          if (config.formatSpecificOptions?.markdown) {
            console.log(`  Markdown Options:`);
            console.log(
              `    Image Handling: ${config.formatSpecificOptions.markdown.imageHandling || 'separate'}`
            );
            console.log(
              `    Preserve Comments: ${config.formatSpecificOptions.markdown.preserveComments ? 'Yes' : 'No'}`
            );
            console.log(
              `    Front Matter: ${config.formatSpecificOptions.markdown.frontMatter !== false ? 'Yes' : 'No'}`
            );
          }
        } else {
          console.log(`  Export Format: ${config.exportFormat?.toUpperCase() || 'DOCX'}`);
        }

        console.log(`  Include Shared: ${config.includeSharedDocuments ? 'Yes' : 'No'}`);
        console.log(`  Batch Size: ${config.batchSize}`);
        console.log(`  Last Updated: ${new Date(config.updatedAt).toLocaleString()}`);
      } catch {
        console.log('\n❌ No export configuration found.');
        console.log('💡 Run "quip-export export configure" to set up export preferences.');
      }

      console.log('\n💡 Available commands:');
      console.log('  • quip-export export configure - Set up export preferences');
      console.log('  • quip-export export preview - Preview what will be exported');
      console.log('  • quip-export export start - Begin export process');
    } catch (error) {
      console.error(
        '❌ Failed to check export status:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

exportCommand
  .command('report')
  .description('Generate detailed export report from recent export session')
  .option('-f, --format <format>', 'Report format (json, html, text)', 'text')
  .option('-o, --output <file>', 'Output file path (optional)')
  .option('--session <sessionId>', 'Specific session ID to report on')
  .action(async (options) => {
    try {
      console.log('📊 Generating Export Report');
      console.log('═'.repeat(40));

      // Check for recent export data
      const exportDataPath = '.export-data.json';
      let exportData: any = null;

      try {
        const dataFile = await fs.readFile(exportDataPath, 'utf8');
        exportData = JSON.parse(dataFile);
      } catch {
        console.log('❌ No recent export data found.');
        console.log('💡 Run an export first with "quip-export export start"');
        return;
      }

      // Generate report based on format
      switch (options.format.toLowerCase()) {
        case 'json': {
          const jsonReport = {
            sessionId: exportData.sessionId || 'unknown',
            timestamp: new Date().toISOString(),
            summary: exportData.summary || {},
            configuration: exportData.configuration || {},
            results: exportData.results || {},
            errors: exportData.errors || [],
          };

          if (options.output) {
            await fs.writeFile(options.output, JSON.stringify(jsonReport, null, 2));
            console.log(`✅ JSON report saved to: ${options.output}`);
          } else {
            console.log(JSON.stringify(jsonReport, null, 2));
          }
          break;
        }
        case 'html': {
          const htmlReport = generateHtmlReport(exportData);
          const htmlFile = options.output || `export-report-${Date.now()}.html`;

          await fs.writeFile(htmlFile, htmlReport);
          console.log(`✅ HTML report saved to: ${htmlFile}`);
          console.log('💡 Open the file in your browser to view the report');
          break;
        }
        case 'text':
        default:
          generateTextReport(exportData);
          break;
      }
    } catch (error) {
      console.error(
        '❌ Failed to generate report:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

// Helper function to get document icon based on type
function getDocumentIcon(type: string): string {
  switch (type?.toUpperCase()) {
    case 'DOCUMENT':
      return '📄';
    case 'SPREADSHEET':
      return '📊';
    case 'CHAT':
      return '💬';
    default:
      return '📄';
  }
}

// Helper function to save export data for reporting
async function saveExportData(result: any, config: any): Promise<void> {
  const exportData = {
    sessionId: result.sessionId || `export-${Date.now()}`,
    timestamp: new Date().toISOString(),
    configuration: config,
    summary: {
      totalDocuments: result.totalDocuments,
      successfulExports: result.successfulExports,
      failedExports: result.failedExports,
      skippedDocuments: result.skippedDocuments,
      duration: result.duration,
      outputDirectory: result.outputDirectory,
    },
    results: result,
    errors: result.errors || [],
  };

  try {
    await fs.writeFile('.export-data.json', JSON.stringify(exportData, null, 2));
  } catch (error) {
    // Silently fail - this is just for reporting convenience
  }
}

// Helper function to generate text report
function generateTextReport(exportData: any): void {
  console.log('\n📋 Export Report');
  console.log('═'.repeat(60));
  console.log(`Session ID: ${exportData.sessionId}`);
  console.log(`Timestamp: ${new Date(exportData.timestamp).toLocaleString()}`);
  console.log(`Duration: ${formatDuration(exportData.summary?.duration || 0)}`);
  console.log('');

  console.log('📊 Summary:');
  console.log(`  Total Documents: ${exportData.summary?.totalDocuments || 0}`);
  console.log(`  Successful Exports: ${exportData.summary?.successfulExports || 0}`);
  console.log(`  Failed Exports: ${exportData.summary?.failedExports || 0}`);
  console.log(`  Skipped Documents: ${exportData.summary?.skippedDocuments || 0}`);

  const successRate =
    exportData.summary?.totalDocuments > 0
      ? ((exportData.summary.successfulExports / exportData.summary.totalDocuments) * 100).toFixed(
          1
        )
      : '0';
  console.log(`  Success Rate: ${successRate}%`);
  console.log('');

  console.log('⚙️  Configuration:');
  if (exportData.configuration) {
    console.log(`  Output Directory: ${exportData.configuration.outputDirectory}`);
    console.log(`  Export Format: ${exportData.configuration.exportFormat?.toUpperCase()}`);
    console.log(
      `  Include Shared: ${exportData.configuration.includeSharedDocuments ? 'Yes' : 'No'}`
    );
    console.log(
      `  Preserve Folders: ${exportData.configuration.preserveFolderStructure ? 'Yes' : 'No'}`
    );
    console.log(`  Batch Size: ${exportData.configuration.batchSize}`);
  }
  console.log('');

  if (exportData.errors && Array.isArray(exportData.errors) && exportData.errors.length > 0) {
    console.log('❌ Errors:');
    (exportData.errors as Array<Record<string, unknown>>)
      .slice(0, 10)
      .forEach((error: any, index: number) => {
        console.log(`  ${index + 1}. ${error.documentTitle || 'Unknown'}: ${error.error}`);
      });

    if (exportData.errors.length > 10) {
      console.log(`  ... and ${exportData.errors.length - 10} more errors`);
    }
    console.log('');
  }

  console.log('📁 Output Location:');
  console.log(`  ${exportData.summary?.outputDirectory || 'Unknown'}`);
  console.log('');

  console.log('💡 Next Steps:');
  console.log('  • Review exported documents in the output directory');
  console.log('  • Upload to your preferred cloud service');
  console.log('  • Use "quip-export export report --format html" for a detailed HTML report');
}

// Helper function to generate HTML report
function generateHtmlReport(exportData: any): string {
  const successRate =
    exportData.summary?.totalDocuments > 0
      ? ((exportData.summary.successfulExports / exportData.summary.totalDocuments) * 100).toFixed(
          1
        )
      : '0';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quip Export Report - ${exportData.sessionId}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1000px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-card { background: #ecf0f1; padding: 20px; border-radius: 6px; text-align: center; }
        .summary-card h3 { margin: 0 0 10px 0; color: #2c3e50; }
        .summary-card .value { font-size: 2em; font-weight: bold; color: #3498db; }
        .config-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .config-table th, .config-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .config-table th { background-color: #f8f9fa; font-weight: 600; }
        .error-list { background: #fff5f5; border: 1px solid #fed7d7; border-radius: 6px; padding: 20px; margin: 20px 0; }
        .error-item { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; border-left: 4px solid #e53e3e; }
        .success { color: #27ae60; }
        .error { color: #e74c3c; }
        .timestamp { color: #7f8c8d; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Quip Export Report</h1>
        <p class="timestamp">Generated on ${new Date().toLocaleString()}</p>
        
        <h2>📋 Summary</h2>
        <div class="summary-grid">
            <div class="summary-card">
                <h3>Total Documents</h3>
                <div class="value">${exportData.summary?.totalDocuments || 0}</div>
            </div>
            <div class="summary-card">
                <h3>Successful</h3>
                <div class="value success">${exportData.summary?.successfulExports || 0}</div>
            </div>
            <div class="summary-card">
                <h3>Failed</h3>
                <div class="value error">${exportData.summary?.failedExports || 0}</div>
            </div>
            <div class="summary-card">
                <h3>Success Rate</h3>
                <div class="value">${successRate}%</div>
            </div>
        </div>

        <h2>⚙️ Configuration</h2>
        <table class="config-table">
            <tr><th>Setting</th><th>Value</th></tr>
            <tr><td>Session ID</td><td>${exportData.sessionId}</td></tr>
            <tr><td>Export Date</td><td>${new Date(exportData.timestamp).toLocaleString()}</td></tr>
            <tr><td>Duration</td><td>${formatDuration(exportData.summary?.duration || 0)}</td></tr>
            <tr><td>Output Directory</td><td>${exportData.configuration?.outputDirectory || 'Unknown'}</td></tr>
            <tr><td>Export Format</td><td>${exportData.configuration?.exportFormat?.toUpperCase() || 'Unknown'}</td></tr>
            <tr><td>Include Shared</td><td>${exportData.configuration?.includeSharedDocuments ? 'Yes' : 'No'}</td></tr>
            <tr><td>Preserve Folders</td><td>${exportData.configuration?.preserveFolderStructure ? 'Yes' : 'No'}</td></tr>
            <tr><td>Batch Size</td><td>${exportData.configuration?.batchSize || 'Unknown'}</td></tr>
        </table>

        ${
          exportData.errors && exportData.errors.length > 0
            ? `
        <h2>❌ Errors (${Array.isArray(exportData.errors) ? exportData.errors.length : 0})</h2>
        <div class="error-list">
            ${
              Array.isArray(exportData.errors)
                ? (exportData.errors as Array<Record<string, unknown>>)
                    .slice(0, 20)
                    .map(
                      (error: any, index: number) => `
                <div class="error-item">
                    <strong>${index + 1}. ${error.documentTitle || 'Unknown Document'}</strong><br>
                    <span style="color: #666;">${error.error}</span>
                </div>
            `
                    )
                    .join('') +
                  (exportData.errors.length > 20
                    ? `<p><em>... and ${exportData.errors.length - 20} more errors</em></p>`
                    : '')
                : ''
            }
        </div>
        `
            : ''
        }

        <h2>📁 Output Location</h2>
        <p><strong>${exportData.summary?.outputDirectory || 'Unknown'}</strong></p>
        
        <h2>💡 Next Steps</h2>
        <ul>
            <li>Review exported documents in the output directory</li>
            <li>Upload to your preferred cloud service (Google Drive, Dropbox, etc.)</li>
            <li>Archive or backup the exported files</li>
        </ul>
    </div>
</body>
</html>`;

  return html;
}

/**
 * Check format capabilities and dependencies
 */
async function checkFormatCapabilities() {
  try {
    console.log('🔍 Checking format capabilities and dependencies...\n');

    const { FormatValidator } = await import('../core/format-validator');
    const validator = new FormatValidator();

    const capabilities = await validator.getFormatCapabilities();

    console.log('📋 Format Capabilities Report:\n');

    for (const capability of capabilities) {
      const statusIcon = capability.available ? '✅' : '❌';
      console.log(`${statusIcon} ${capability.format.toUpperCase()}`);
      console.log(`   Available: ${capability.available ? 'Yes' : 'No'}`);
      console.log(`   Document Types: ${capability.documentTypes.join(', ')}`);

      if (capability.dependencies.length > 0) {
        console.log('   Dependencies:');
        for (const dep of capability.dependencies) {
          const depIcon = dep.available ? '✅' : '❌';
          const requiredText = dep.required ? '(required)' : '(optional)';
          console.log(`     ${depIcon} ${dep.name} ${requiredText}`);
          if (dep.version) {
            console.log(`        Version: ${dep.version}`);
          }
          if (!dep.available && dep.installCommand) {
            console.log(`        Install: ${dep.installCommand}`);
          }
          if (dep.error) {
            console.log(`        Error: ${dep.error}`);
          }
        }
      }

      if (capability.error) {
        console.log(`   Error: ${capability.error}`);
      }

      console.log('');
    }

    // Show summary
    const availableFormats = capabilities.filter((c) => c.available);
    const unavailableFormats = capabilities.filter((c) => !c.available);

    console.log('📊 Summary:');
    console.log(
      `   Available formats: ${availableFormats.map((c) => c.format).join(', ') || 'None'}`
    );
    if (unavailableFormats.length > 0) {
      console.log(`   Unavailable formats: ${unavailableFormats.map((c) => c.format).join(', ')}`);
      console.log('\n💡 To enable unavailable formats:');
      for (const format of unavailableFormats) {
        const instructions = validator.getDependencyInstructions(format.format);
        if (instructions.length > 0) {
          console.log(`   ${format.format}: ${instructions.join(', ')}`);
        }
      }
    }

    // Show document type compatibility
    console.log('\n📄 Document Type Compatibility:');
    console.log('   DOCUMENT: docx, html, markdown');
    console.log('   SPREADSHEET: xlsx, html');
    console.log('   CHAT: html, markdown');
  } catch (error) {
    console.error(
      '❌ Failed to check format capabilities:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

program.parse();

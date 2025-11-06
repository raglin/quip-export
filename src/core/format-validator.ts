/**
 * Format validation and dependency management for export formats
 */

export interface FormatCapability {
  format: string;
  available: boolean;
  dependencies: DependencyInfo[];
  documentTypes: string[];
  error?: string;
}

export interface DependencyInfo {
  name: string;
  required: boolean;
  available: boolean;
  version?: string;
  installCommand?: string;
  error?: string;
}

export interface FormatValidationResult {
  valid: boolean;
  capabilities: FormatCapability[];
  errors: string[];
  warnings: string[];
}

export interface DocumentTypeCompatibility {
  documentType: string;
  supportedFormats: string[];
  recommendedFormats: string[];
  warnings: { [format: string]: string };
}

/**
 * Format capability detector and validator
 */
export class FormatValidator {
  private static readonly SUPPORTED_FORMATS = ['native', 'html', 'markdown'];
  
  private static readonly DOCUMENT_TYPE_COMPATIBILITY: DocumentTypeCompatibility[] = [
    {
      documentType: 'DOCUMENT',
      supportedFormats: ['native', 'html', 'markdown'],
      recommendedFormats: ['native'],
      warnings: {
        'html': 'HTML export may not preserve all formatting for documents',
        'markdown': 'Markdown export requires additional dependencies and may lose some formatting'
      }
    },
    {
      documentType: 'SPREADSHEET',
      supportedFormats: ['native', 'html'],
      recommendedFormats: ['native'],
      warnings: {
        'html': 'HTML export may not preserve spreadsheet functionality'
      }
    },

    {
      documentType: 'CHAT',
      supportedFormats: ['native', 'html', 'markdown'],
      recommendedFormats: ['native', 'html'],
      warnings: {
        'markdown': 'Markdown export may not preserve chat threading and timestamps'
      }
    }
  ];

  private static readonly FORMAT_DEPENDENCIES: { [format: string]: DependencyInfo[] } = {
    'markdown': [
      {
        name: 'turndown',
        required: true,
        available: false,
        installCommand: 'npm install turndown @types/turndown'
      },
      {
        name: 'cheerio',
        required: true,
        available: false,
        installCommand: 'npm install cheerio @types/cheerio'
      }
    ],
    'native': [],  // Native format has no dependencies
    'html': []
  };

  /**
   * Check if required dependencies are available for a format
   */
  async checkFormatDependencies(format: string): Promise<DependencyInfo[]> {
    const dependencies = FormatValidator.FORMAT_DEPENDENCIES[format] || [];
    const checkedDependencies: DependencyInfo[] = [];

    for (const dep of dependencies) {
      const checkedDep = { ...dep };
      
      try {
        // Try to require the dependency
        const module = await this.tryRequire(dep.name);
        checkedDep.available = !!module;
        
        if (module && typeof module.version === 'string') {
          checkedDep.version = module.version;
        }
      } catch (error) {
        checkedDep.available = false;
        checkedDep.error = error instanceof Error ? error.message : String(error);
      }
      
      checkedDependencies.push(checkedDep);
    }

    return checkedDependencies;
  }

  /**
   * Get format capabilities for all supported formats
   */
  async getFormatCapabilities(): Promise<FormatCapability[]> {
    const capabilities: FormatCapability[] = [];

    for (const format of FormatValidator.SUPPORTED_FORMATS) {
      const dependencies = await this.checkFormatDependencies(format);
      const missingRequired = dependencies.filter(dep => dep.required && !dep.available);
      
      const capability: FormatCapability = {
        format,
        available: missingRequired.length === 0,
        dependencies,
        documentTypes: this.getSupportedDocumentTypes(format),
        error: missingRequired.length > 0 
          ? `Missing required dependencies: ${missingRequired.map(d => d.name).join(', ')}`
          : undefined
      };

      capabilities.push(capability);
    }

    return capabilities;
  }

  /**
   * Validate format selections against available capabilities
   */
  async validateFormatSelection(
    formats: string[], 
    documentTypes?: string[]
  ): Promise<FormatValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const capabilities = await this.getFormatCapabilities();

    // Check if formats are supported
    const unsupportedFormats = formats.filter(
      format => !FormatValidator.SUPPORTED_FORMATS.includes(format)
    );
    if (unsupportedFormats.length > 0) {
      errors.push(
        `Unsupported formats: ${unsupportedFormats.join(', ')}. ` +
        `Supported formats: ${FormatValidator.SUPPORTED_FORMATS.join(', ')}`
      );
    }

    // Check format capabilities
    const unavailableFormats: string[] = [];
    for (const format of formats) {
      const capability = capabilities.find(c => c.format === format);
      if (capability && !capability.available) {
        unavailableFormats.push(format);
        errors.push(
          `Format '${format}' is not available: ${capability.error || 'Unknown error'}`
        );
      }
    }

    // Check document type compatibility if provided
    if (documentTypes && documentTypes.length > 0) {
      for (const docType of documentTypes) {
        const compatibility = this.getDocumentTypeCompatibility(docType);
        if (compatibility) {
          const incompatibleFormats = formats.filter(
            format => !compatibility.supportedFormats.includes(format)
          );
          
          if (incompatibleFormats.length > 0) {
            errors.push(
              `Formats ${incompatibleFormats.join(', ')} are not compatible with document type '${docType}'. ` +
              `Supported formats: ${compatibility.supportedFormats.join(', ')}`
            );
          }

          // Add warnings for suboptimal format choices
          for (const format of formats) {
            if (compatibility.warnings[format]) {
              warnings.push(`${docType} + ${format}: ${compatibility.warnings[format]}`);
            }
          }

          // Suggest recommended formats if none are selected
          const hasRecommended = formats.some(f => compatibility.recommendedFormats.includes(f));
          if (!hasRecommended && compatibility.recommendedFormats.length > 0) {
            warnings.push(
              `For ${docType} documents, consider using recommended formats: ${compatibility.recommendedFormats.join(', ')}`
            );
          }
        }
      }
    }

    // Ensure at least one format is available
    const availableFormats = formats.filter(format => {
      const capability = capabilities.find(c => c.format === format);
      return capability && capability.available;
    });

    if (availableFormats.length === 0 && formats.length > 0) {
      errors.push(
        'No selected formats are currently available. Please install required dependencies or select different formats.'
      );
    }

    return {
      valid: errors.length === 0,
      capabilities,
      errors,
      warnings
    };
  }

  /**
   * Get dependency installation instructions for missing dependencies
   */
  getDependencyInstructions(format: string): string[] {
    const dependencies = FormatValidator.FORMAT_DEPENDENCIES[format] || [];
    const instructions: string[] = [];

    for (const dep of dependencies) {
      if (dep.required && dep.installCommand) {
        instructions.push(`Install ${dep.name}: ${dep.installCommand}`);
      }
    }

    return instructions;
  }

  /**
   * Check if graceful degradation is possible for unavailable formats
   */
  getGracefulDegradationOptions(
    unavailableFormats: string[]
  ): { [format: string]: string[] } {
    const alternatives: { [format: string]: string[] } = {};

    for (const format of unavailableFormats) {
      const fallbacks: string[] = [];

      switch (format) {
        case 'markdown':
          // Markdown can fall back to HTML
          fallbacks.push('html');
          break;
        
        case 'native':
          // Native format can fall back to HTML
          fallbacks.push('html');
          break;
      }

      if (fallbacks.length > 0) {
        alternatives[format] = fallbacks;
      }
    }

    return alternatives;
  }

  /**
   * Get supported document types for a format
   */
  private getSupportedDocumentTypes(format: string): string[] {
    const types: string[] = [];
    
    for (const compatibility of FormatValidator.DOCUMENT_TYPE_COMPATIBILITY) {
      if (compatibility.supportedFormats.includes(format)) {
        types.push(compatibility.documentType);
      }
    }
    
    return types;
  }

  /**
   * Get document type compatibility information
   */
  private getDocumentTypeCompatibility(documentType: string): DocumentTypeCompatibility | undefined {
    return FormatValidator.DOCUMENT_TYPE_COMPATIBILITY.find(
      compat => compat.documentType === documentType
    );
  }

  /**
   * Try to require a module without throwing
   */
  private async tryRequire(moduleName: string): Promise<any> {
    try {
      // Use dynamic import for better compatibility
      return await import(moduleName);
    } catch (error) {
      // Try require as fallback
      try {
        return require(moduleName);
      } catch (requireError) {
        throw error; // Throw the original import error
      }
    }
  }
}
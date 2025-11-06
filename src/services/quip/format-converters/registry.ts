import { IFormatConverter, ConversionResult } from './interfaces';

/**
 * Registry for managing format converters
 */
export class FormatConverterRegistry {
  private converters: Map<string, IFormatConverter> = new Map();

  /**
   * Register a format converter
   */
  register(converter: IFormatConverter): void {
    const name = converter.getName();
    if (this.converters.has(name)) {
      throw new Error(`Converter with name '${name}' is already registered`);
    }
    this.converters.set(name, converter);
  }

  /**
   * Unregister a format converter
   */
  unregister(converterName: string): boolean {
    return this.converters.delete(converterName);
  }

  /**
   * Get a converter by name
   */
  getConverter(name: string): IFormatConverter | undefined {
    return this.converters.get(name);
  }

  /**
   * Find a converter that can handle the given document type and target format
   */
  findConverter(documentType: string, targetFormat: string): IFormatConverter | undefined {
    for (const converter of this.converters.values()) {
      if (converter.canConvert(documentType, targetFormat)) {
        return converter;
      }
    }
    return undefined;
  }

  /**
   * Get all registered converters
   */
  getAllConverters(): IFormatConverter[] {
    return Array.from(this.converters.values());
  }

  /**
   * Get all supported formats across all converters
   */
  getSupportedFormats(): string[] {
    const formats = new Set<string>();
    for (const converter of this.converters.values()) {
      converter.getSupportedFormats().forEach(format => formats.add(format));
    }
    return Array.from(formats);
  }

  /**
   * Check if a format is supported by any registered converter
   */
  isFormatSupported(format: string): boolean {
    return this.getSupportedFormats().includes(format);
  }

  /**
   * Convert content using the appropriate converter
   */
  async convert(
    documentType: string,
    targetFormat: string,
    content: string | Buffer,
    options?: any
  ): Promise<ConversionResult> {
    const converter = this.findConverter(documentType, targetFormat);
    
    if (!converter) {
      return {
        success: false,
        format: targetFormat,
        error: `No converter found for document type '${documentType}' to format '${targetFormat}'`
      };
    }

    try {
      return await converter.convert(content, options);
    } catch (error) {
      return {
        success: false,
        format: targetFormat,
        error: error instanceof Error ? error.message : 'Unknown conversion error'
      };
    }
  }

  /**
   * Get the number of registered converters
   */
  getConverterCount(): number {
    return this.converters.size;
  }

  /**
   * Clear all registered converters
   */
  clear(): void {
    this.converters.clear();
  }
}
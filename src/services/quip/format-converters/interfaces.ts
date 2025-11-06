/**
 * Base interfaces for format conversion system
 */

export interface ConversionResult {
  success: boolean;
  content?: Buffer;
  format: string;
  error?: string;
  metadata?: {
    [key: string]: any;
  };
}

export interface IFormatConverter {
  /**
   * Check if this converter can handle the given document type and target format
   */
  canConvert(documentType: string, targetFormat: string): boolean;

  /**
   * Convert content to the target format
   */
  convert(content: string | Buffer, options?: any): Promise<ConversionResult>;

  /**
   * Get list of formats this converter supports
   */
  getSupportedFormats(): string[];

  /**
   * Get the name/identifier of this converter
   */
  getName(): string;
}

export interface FormatConverterOptions {
  [key: string]: any;
}
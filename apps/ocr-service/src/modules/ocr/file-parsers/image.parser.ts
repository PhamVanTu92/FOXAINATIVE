import * as path from 'path';
import type { IFileParser, ParsedFile } from './file-parser.interface';

const MIME_MAP: Record<string, string> = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.tiff': 'image/tiff',
  '.tif':  'image/tiff',
};

/**
 * Chuyển file ảnh thành base64 để gửi cho Vision AI dưới dạng image block.
 * MIME type được suy ra từ extension của file.
 */
export class ImageParser implements IFileParser {
  private static readonly SUPPORTED = new Set(Object.keys(MIME_MAP));

  validate(fileExtension: string): boolean {
    return ImageParser.SUPPORTED.has(fileExtension.toLowerCase());
  }

  async parse(fileBuffer: Buffer, filePath: string): Promise<ParsedFile> {
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_MAP[ext] ?? 'image/jpeg';
    return {
      type: 'image',
      content: fileBuffer.toString('base64'),
      mimeType,
    };
  }
}

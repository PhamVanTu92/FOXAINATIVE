import { diskStorage } from 'multer';
import { extname, join } from 'path';

const FILE_TYPE_MAP: Record<string, string> = {
  '.pdf': 'PDF',
  '.doc': 'Word',
  '.docx': 'Word',
  '.xls': 'Excel',
  '.xlsx': 'Excel',
  '.ppt': 'PowerPoint',
  '.pptx': 'PowerPoint',
  '.txt': 'Text',
  '.jpg': 'Image',
  '.jpeg': 'Image',
  '.png': 'Image',
  '.gif': 'Image',
  '.webp': 'Image',
};

export function detectFileType(filename: string): string {
  return FILE_TYPE_MAP[extname(filename).toLowerCase()] ?? 'PDF';
}

export function toPublicUrl(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const base = (process.env['PUBLIC_URL'] ?? 'http://localhost:3001').replace(/\/$/, '');
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try { return `${base}${new URL(path).pathname}`; } catch { return path; }
  }
  return `${base}/${path}`;
}

export const multerOptions = {
  storage: diskStorage({
    destination: join(process.cwd(), 'uploads', 'knowledge-files'),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      cb(null, `${unique}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
};

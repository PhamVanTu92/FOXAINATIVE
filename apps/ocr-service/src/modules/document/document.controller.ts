import * as fs from 'fs';
import * as path from 'path';
import { Observable } from 'rxjs';
import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus,
  MessageEvent, NotFoundException, Param, Patch, Post, Query, Res, Sse,
  StreamableFile, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BulkActionDto, ConfirmDocumentDto, FilterDocumentDto, UpdateDocumentDto, UploadDocumentDto } from './dto/document.dto';
import type { Express } from 'express';
import { DocumentService } from './document.service';

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_MIMES = [
  // PDF
  'application/pdf',
  // Ảnh
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/tiff',
  // Word (chỉ DOCX – mammoth không hỗ trợ .doc cũ)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Excel
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                           // .xls
  // CSV (browser có thể gửi nhiều MIME type khác nhau cho CSV)
  'text/csv', 'text/plain', 'application/csv',
];
const UPLOAD_DIR = process.env['UPLOAD_DIR'] ? path.resolve(process.env['UPLOAD_DIR']) : path.resolve(__dirname, '../../../../../uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

@ApiTags('Documents')
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Tải file và đẩy vào hàng đợi OCR' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, schemaId: { type: 'string' }, language: { type: 'string', enum: ['vi', 'en', 'vi+en'] } } } })
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({ destination: UPLOAD_DIR, filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`) }),
    limits: { fileSize: MAX_FILE_SIZE },
  }))
  async upload(@UploadedFile() file: Express.Multer.File | undefined, @Body() dto: UploadDocumentDto) {
    if (!file) throw new BadRequestException('Không nhận được file.');
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      fs.unlinkSync(file.path);
      throw new BadRequestException(`Định dạng "${file.mimetype}" không được hỗ trợ.`);
    }
    const fileUrl = `file://${file.path.replace(/\\/g, '/')}`;
    const result = await this.documentService.createFromUpload({ schemaId: dto.schemaId, fileUrl, fileName: file.originalname, fileSize: file.size, mimeType: file.mimetype, language: dto.language ?? 'vi' });
    return { documentId: result.documentId, jobId: result.jobId, status: 'QUEUED' as const, message: 'Đã tiếp nhận file. Hệ thống đang quét OCR ở chế độ nền.' };
  }

  @Get('stats') @ApiOperation({ summary: 'Thống kê chứng từ theo trạng thái' })
  getStats() { return this.documentService.getStats(); }

  @Get() @ApiOperation({ summary: 'Danh sách chứng từ (filter + pagination)' })
  findMany(@Query() filter: FilterDocumentDto): Promise<unknown> { return this.documentService.findMany(filter); }

  @Get(':id/job-status') @ApiOperation({ summary: 'Kiểm tra trạng thái job OCR trên hàng đợi' })
  getJobStatus(@Param('id') id: string) { return this.documentService.getJobStatus(id); }

  @Sse(':id/sse') @ApiOperation({ summary: 'SSE stream theo dõi tiến trình OCR real-time' })
  streamJobEvents(@Param('id') id: string): Observable<MessageEvent> {
    return this.documentService.streamJobEvents(id);
  }

  @Get(':id/file') @ApiOperation({ summary: 'Xem file gốc của chứng từ' })
  async serveFile(@Param('id') id: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const doc = await this.documentService.findOne(id);
    const filePath = (doc.fileUrl ?? '').replace(/^file:\/\//, '');
    if (!filePath || !fs.existsSync(filePath))
      throw new NotFoundException('File gốc không tìm thấy trên máy chủ.');
    res.set({
      'Content-Type': doc.mimeType ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName ?? 'document')}`,
    });
    return new StreamableFile(fs.createReadStream(filePath));
  }

  @Get(':id') @ApiOperation({ summary: 'Chi tiết chứng từ' })
  findOne(@Param('id') id: string): Promise<unknown> { return this.documentService.findOne(id); }

  @Patch(':id') @ApiOperation({ summary: 'Cập nhật giá trị trường / dòng hàng' })
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto): Promise<unknown> { return this.documentService.update(id, dto); }

  @Post(':id/confirm') @ApiOperation({ summary: 'Xác nhận chứng từ' })
  confirm(@Param('id') id: string, @Body() dto: ConfirmDocumentDto): Promise<unknown> { return this.documentService.confirm(id, dto); }

  @Delete(':id') @ApiOperation({ summary: 'Xóa chứng từ' })
  remove(@Param('id') id: string) { return this.documentService.remove(id); }

  @Post(':id/transfer') @ApiOperation({ summary: 'Chuyển chứng từ vào kho tri thức' })
  transfer(@Param('id') id: string) { return this.documentService.transfer(id); }

  @Post('bulk-confirm') bulkConfirm(@Body() dto: BulkActionDto) { return this.documentService.bulkConfirm(dto); }
  @Post('bulk-transfer') @ApiOperation({ summary: 'Chuyển hàng loạt vào kho tri thức' })
  bulkTransfer(@Body() dto: BulkActionDto) { return this.documentService.bulkTransfer(dto); }
  @Post('bulk-delete') bulkDelete(@Body() dto: BulkActionDto) { return this.documentService.bulkDelete(dto); }
}

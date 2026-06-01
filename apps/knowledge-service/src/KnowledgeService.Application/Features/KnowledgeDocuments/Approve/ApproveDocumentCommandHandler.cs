using System.IO;
using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using KnowledgeService.Domain.Entities;
using Mapster;
using MediatR;
using Microsoft.Extensions.Logging;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.Approve;

public class ApproveDocumentCommandHandler : IRequestHandler<ApproveDocumentCommand, KnowledgeDocumentDto>
{
    private readonly IKnowledgeDocumentRepository _repo;
    private readonly IKnowledgeFileRepository _fileRepo;
    private readonly IKnowledgeBaseRepository _kbRepo;
    private readonly IUnitOfWork _uow;
    private readonly IIndexingQueue _indexingQueue;
    private readonly ILogger<ApproveDocumentCommandHandler> _logger;

    public ApproveDocumentCommandHandler(
        IKnowledgeDocumentRepository repo,
        IKnowledgeFileRepository fileRepo,
        IKnowledgeBaseRepository kbRepo,
        IUnitOfWork uow,
        IIndexingQueue indexingQueue,
        ILogger<ApproveDocumentCommandHandler> logger)
    {
        _repo = repo;
        _fileRepo = fileRepo;
        _kbRepo = kbRepo;
        _uow = uow;
        _indexingQueue = indexingQueue;
        _logger = logger;
    }

    public async Task<KnowledgeDocumentDto> Handle(ApproveDocumentCommand cmd, CancellationToken ct)
    {
        var doc = await _repo.GetByIdAsync(cmd.Id, ct)
            ?? throw new NotFoundException(nameof(KnowledgeDocument), cmd.Id);

        doc.Approve();
        _repo.Update(doc);

        // Đồng bộ KnowledgeFile trong bộ tri thức tương ứng (chỉ khi tài liệu thuộc một bộ tri thức)
        if (doc.KnowledgeBaseId.HasValue)
        {
            var existingFile = await _fileRepo.GetBySourceDocumentIdAsync(doc.Id, ct);
            if (existingFile is null)
            {
                var newFile = new KnowledgeFile
                {
                    FileName = doc.Title,
                    FileType = doc.FileType,
                    FileSizeMb = doc.FileSizeMb,
                    StoragePath = doc.StoragePath,
                    UploadedBy = doc.UploadedBy,
                    UploadedAt = doc.UploadedAt,
                    SourceDocumentId = doc.Id,
                };
                await _fileRepo.AddAsync(newFile, ct);
                await _fileRepo.AddToKnowledgeBaseAsync(newFile.Id, doc.KnowledgeBaseId.Value, ct);
            }
            else
            {
                // Cập nhật lại nếu đã tồn tại (re-approve sau rollback)
                existingFile.FileName = doc.Title;
                existingFile.FileType = doc.FileType;
                existingFile.FileSizeMb = doc.FileSizeMb;
                existingFile.StoragePath = doc.StoragePath;
                // Đảm bảo vẫn còn liên kết với KB (phòng trường hợp đã bị gỡ)
                await _fileRepo.AddToKnowledgeBaseAsync(existingFile.Id, doc.KnowledgeBaseId.Value, ct);
                _fileRepo.Update(existingFile);
            }
        }

        await _uow.SaveChangesAsync(ct);

        // Gửi file sang index-service để indexing nếu KB có collection và document có file
        var kb = doc.KnowledgeBaseId.HasValue
            ? await _kbRepo.GetByIdAsync(doc.KnowledgeBaseId.Value, ct)
            : null;
        _logger.LogInformation(
            "ApproveDocument → docId={DocId}, kbId={KbId}, collectionId={CollectionId}, storagePath={StoragePath}",
            doc.Id, doc.KnowledgeBaseId, kb?.CollectionId?.ToString() ?? "null", doc.StoragePath ?? "null");

        if (kb?.CollectionId is Guid collectionId && doc.StoragePath is not null)
        {
            var ext = Path.GetExtension(doc.StoragePath).TrimStart('.').ToLower();
            _logger.LogInformation(
                "ApproveDocument → enqueue index-service collectionId={CollectionId}, ext={Ext}, version={Version}",
                collectionId, ext, doc.CurrentVersion);
            _indexingQueue.Enqueue(new IndexingTask(
                collectionId,
                doc.StoragePath,
                doc.Title,
                ext,
                doc.CurrentVersion));
        }
        else
        {
            _logger.LogWarning(
                "ApproveDocument → SKIP index-service: collectionId={CollectionId}, storagePath={StoragePath}",
                kb?.CollectionId?.ToString() ?? "null", doc.StoragePath ?? "null");
        }

        return doc.Adapt<KnowledgeDocumentDto>();
    }
}

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
        // GetByIdAsync đã include KnowledgeBases
        var doc = await _repo.GetByIdAsync(cmd.Id, ct)
            ?? throw new NotFoundException(nameof(KnowledgeDocument), cmd.Id);

        doc.Approve();
        _repo.Update(doc);

        // Đồng bộ KnowledgeFile cho tài liệu đã được approve
        //if (doc.KnowledgeBases.Any())
        //{
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
                // Gắn file với tất cả các KB của tài liệu
                foreach (var kb in doc.KnowledgeBases)
                    await _fileRepo.AddToKnowledgeBaseAsync(newFile.Id, kb.Id, ct);
            }
            else
            {
                // Cập nhật lại nếu đã tồn tại (re-approve sau rollback)
                existingFile.FileName = doc.Title;
                existingFile.FileType = doc.FileType;
                existingFile.FileSizeMb = doc.FileSizeMb;
                existingFile.StoragePath = doc.StoragePath;
                // Đảm bảo file vẫn liên kết với tất cả KB của tài liệu
                foreach (var kb in doc.KnowledgeBases)
                    await _fileRepo.AddToKnowledgeBaseAsync(existingFile.Id, kb.Id, ct);
                _fileRepo.Update(existingFile);
            }
        //}

        await _uow.SaveChangesAsync(ct);

        // Gửi sang index-service cho từng KB có collection
        _logger.LogInformation(
            "ApproveDocument → docId={DocId}, kbCount={KbCount}, storagePath={StoragePath}",
            doc.Id, doc.KnowledgeBases.Count, doc.StoragePath ?? "null");

        if (doc.StoragePath is not null)
        {
            var ext = Path.GetExtension(doc.StoragePath).TrimStart('.').ToLower();
            foreach (var kb in doc.KnowledgeBases)
            {
                if (kb.CollectionId is Guid collectionId)
                {
                    _logger.LogInformation(
                        "ApproveDocument → enqueue collectionId={CollectionId}, ext={Ext}, version={Version}",
                        collectionId, ext, doc.CurrentVersion);
                    _indexingQueue.Enqueue(new IndexingTask(
                        collectionId, doc.StoragePath, doc.Title, ext, doc.CurrentVersion));
                }
                else
                {
                    _logger.LogWarning(
                        "ApproveDocument → SKIP index-service: kbId={KbId} không có collectionId",
                        kb.Id);
                }
            }
        }
        else
        {
            _logger.LogWarning("ApproveDocument → SKIP index-service: storagePath is null");
        }

        return doc.Adapt<KnowledgeDocumentDto>();
    }
}

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
    private readonly ICurrentTokenProvider _tokenProvider;
    private readonly ILogger<ApproveDocumentCommandHandler> _logger;

    public ApproveDocumentCommandHandler(
        IKnowledgeDocumentRepository repo,
        IKnowledgeFileRepository fileRepo,
        IKnowledgeBaseRepository kbRepo,
        IUnitOfWork uow,
        IIndexingQueue indexingQueue,
        ICurrentTokenProvider tokenProvider,
        ILogger<ApproveDocumentCommandHandler> logger)
    {
        _repo = repo;
        _fileRepo = fileRepo;
        _kbRepo = kbRepo;
        _uow = uow;
        _indexingQueue = indexingQueue;
        _tokenProvider = tokenProvider;
        _logger = logger;
    }

    public async Task<KnowledgeDocumentDto> Handle(ApproveDocumentCommand cmd, CancellationToken ct)
    {
        var doc = await _repo.GetByIdAsync(cmd.Id, ct)
            ?? throw new NotFoundException(nameof(KnowledgeDocument), cmd.Id);

        doc.Approve();
        _repo.Update(doc);

        // Đồng bộ KnowledgeFile trong bộ tri thức tương ứng (chỉ khi tài liệu thuộc một bộ tri thức)
        KnowledgeFile? knowledgeFile = null;
        if (doc.KnowledgeBaseId.HasValue)
        {
            knowledgeFile = await _fileRepo.GetBySourceDocumentIdAsync(doc.Id, ct);
            if (knowledgeFile is null)
            {
                knowledgeFile = new KnowledgeFile
                {
                    KnowledgeBaseId = doc.KnowledgeBaseId.Value,
                    FileName = doc.Title,
                    FileType = doc.FileType,
                    FileSizeMb = doc.FileSizeMb,
                    StoragePath = doc.StoragePath,
                    UploadedBy = doc.UploadedBy,
                    UploadedAt = doc.UploadedAt,
                    SourceDocumentId = doc.Id,
                };
                await _fileRepo.AddAsync(knowledgeFile, ct);
            }
            else
            {
                // Cập nhật lại nếu đã tồn tại (re-approve sau rollback)
                knowledgeFile.FileName = doc.Title;
                knowledgeFile.FileType = doc.FileType;
                knowledgeFile.FileSizeMb = doc.FileSizeMb;
                knowledgeFile.StoragePath = doc.StoragePath;
                _fileRepo.Update(knowledgeFile);
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

        if (kb?.CollectionId is Guid collectionId && doc.StoragePath is not null && knowledgeFile is not null)
        {
            var ext = Path.GetExtension(doc.StoragePath).TrimStart('.').ToLower();
            var authToken = _tokenProvider.GetToken();
            _logger.LogInformation(
                "ApproveDocument → enqueue index-service collectionId={CollectionId}, ext={Ext}, version={Version}, hasToken={HasToken}",
                collectionId, ext, doc.CurrentVersion, authToken is not null);
            _indexingQueue.Enqueue(new IndexingTask(
                collectionId,
                doc.StoragePath,
                doc.Title,
                ext,
                doc.CurrentVersion,
                knowledgeFile.Id,
                authToken));
        }
        else
        {
            _logger.LogWarning(
                "ApproveDocument → SKIP index-service: collectionId={CollectionId}, storagePath={StoragePath}, knowledgeFileId={KnowledgeFileId}",
                kb?.CollectionId?.ToString() ?? "null", doc.StoragePath ?? "null", knowledgeFile?.Id.ToString() ?? "null");
        }

        return doc.Adapt<KnowledgeDocumentDto>();
    }
}

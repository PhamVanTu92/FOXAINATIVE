using System.IO;
using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Application.Features.KnowledgeFiles.Dtos;
using KnowledgeService.Domain.Entities;
using KnowledgeService.Domain.Enums;
using Mapster;
using MediatR;
using Microsoft.Extensions.Logging;

namespace KnowledgeService.Application.Features.KnowledgeFiles.Add;

public class AddKnowledgeFileCommandHandler : IRequestHandler<AddKnowledgeFileCommand, KnowledgeFileDto>
{
    private readonly IKnowledgeBaseRepository _kbRepo;
    private readonly IKnowledgeFileRepository _fileRepo;
    private readonly IUnitOfWork _uow;
    private readonly IIndexingQueue _indexingQueue;
    private readonly ILogger<AddKnowledgeFileCommandHandler> _logger;

    public AddKnowledgeFileCommandHandler(
        IKnowledgeBaseRepository kbRepo,
        IKnowledgeFileRepository fileRepo,
        IUnitOfWork uow,
        IIndexingQueue indexingQueue,
        ILogger<AddKnowledgeFileCommandHandler> logger)
    {
        _kbRepo = kbRepo;
        _fileRepo = fileRepo;
        _uow = uow;
        _indexingQueue = indexingQueue;
        _logger = logger;
    }

    public async Task<KnowledgeFileDto> Handle(AddKnowledgeFileCommand cmd, CancellationToken ct)
    {
        // Bộ tri thức là tùy chọn: chỉ kiểm tra/cập nhật KB khi có gắn KnowledgeBaseId.
        KnowledgeBase? kb = null;
        if (cmd.KnowledgeBaseId.HasValue)
        {
            kb = await _kbRepo.GetByIdAsync(cmd.KnowledgeBaseId.Value, ct)
                ?? throw new NotFoundException(nameof(KnowledgeBase), cmd.KnowledgeBaseId.Value);
        }

        var fileType = Enum.Parse<FileType>(cmd.FileType);
        var now = DateTime.UtcNow;

        var file = new KnowledgeFile
        {
            KnowledgeBaseId = cmd.KnowledgeBaseId,
            FileName = cmd.FileName,
            FileType = fileType,
            FileSizeMb = cmd.FileSizeMb,
            StoragePath = cmd.StoragePath,
            UploadedBy = cmd.UploadedBy,
            UploadedAt = now,
            CreatedAt = now,
            UpdatedAt = now,
            Permissions = cmd.PermittedDepartments.Select(d => new KnowledgeFilePermission
            {
                DepartmentId = d.DepartmentId,
                DepartmentName = d.DepartmentName,
                CreatedAt = now,
                UpdatedAt = now
            }).ToList()
        };

        if (kb is not null)
        {
            kb.UpdatedAt = now;
            _kbRepo.Update(kb);
        }

        await _fileRepo.AddAsync(file, ct);
        await _uow.SaveChangesAsync(ct);

        // Gửi file sang index-service để indexing nếu KB có collection và file có đường dẫn lưu trữ
        _logger.LogInformation(
            "AddKnowledgeFile → fileId={FileId}, kbId={KbId}, collectionId={CollectionId}, storagePath={StoragePath}",
            file.Id, kb?.Id.ToString() ?? "null", kb?.CollectionId?.ToString() ?? "null", file.StoragePath ?? "null");

        if (kb?.CollectionId is Guid collectionId && file.StoragePath is not null)
        {
            var ext = Path.GetExtension(file.StoragePath).TrimStart('.').ToLower();
            _logger.LogInformation(
                "AddKnowledgeFile → enqueue index-service collectionId={CollectionId}, ext={Ext}",
                collectionId, ext);
            _indexingQueue.Enqueue(new IndexingTask(
                collectionId,
                file.StoragePath,
                file.FileName,
                ext,
                "1",
                file.Id));
        }
        else
        {
            _logger.LogWarning(
                "AddKnowledgeFile → SKIP index-service: collectionId={CollectionId}, storagePath={StoragePath}",
                kb?.CollectionId?.ToString() ?? "null", file.StoragePath ?? "null");
        }

        return file.Adapt<KnowledgeFileDto>();
    }
}

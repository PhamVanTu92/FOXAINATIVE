using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using KnowledgeService.Domain.Entities;
using Mapster;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.Approve;

public class ApproveDocumentCommandHandler : IRequestHandler<ApproveDocumentCommand, KnowledgeDocumentDto>
{
    private readonly IKnowledgeDocumentRepository _repo;
    private readonly IKnowledgeFileRepository _fileRepo;
    private readonly IUnitOfWork _uow;

    public ApproveDocumentCommandHandler(
        IKnowledgeDocumentRepository repo,
        IKnowledgeFileRepository fileRepo,
        IUnitOfWork uow)
    {
        _repo = repo;
        _fileRepo = fileRepo;
        _uow = uow;
    }

    public async Task<KnowledgeDocumentDto> Handle(ApproveDocumentCommand cmd, CancellationToken ct)
    {
        var doc = await _repo.GetByIdAsync(cmd.Id, ct)
            ?? throw new NotFoundException(nameof(KnowledgeDocument), cmd.Id);

        doc.Approve();
        _repo.Update(doc);

        // Đồng bộ KnowledgeFile trong bộ tri thức tương ứng
        var existingFile = await _fileRepo.GetBySourceDocumentIdAsync(doc.Id, ct);
        if (existingFile is null)
        {
            await _fileRepo.AddAsync(new KnowledgeFile
            {
                KnowledgeBaseId = doc.KnowledgeBaseId,
                FileName = doc.Title,
                FileType = doc.FileType,
                FileSizeMb = doc.FileSizeMb,
                StoragePath = doc.StoragePath,
                UploadedBy = doc.UploadedBy,
                UploadedAt = doc.UploadedAt,
                SourceDocumentId = doc.Id,
            }, ct);
        }
        else
        {
            // Cập nhật lại nếu đã tồn tại (re-approve sau rollback)
            existingFile.FileName = doc.Title;
            existingFile.FileType = doc.FileType;
            existingFile.FileSizeMb = doc.FileSizeMb;
            existingFile.StoragePath = doc.StoragePath;
            _fileRepo.Update(existingFile);
        }

        await _uow.SaveChangesAsync(ct);

        return doc.Adapt<KnowledgeDocumentDto>();
    }
}

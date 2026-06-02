using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using KnowledgeService.Domain.Entities;
using KnowledgeService.Domain.Enums;
using Mapster;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.Upload;

public class UploadDocumentCommandHandler : IRequestHandler<UploadDocumentCommand, KnowledgeDocumentDto>
{
    private readonly IKnowledgeBaseRepository _kbRepo;
    private readonly IKnowledgeDocumentRepository _docRepo;
    private readonly IUnitOfWork _uow;

    public UploadDocumentCommandHandler(
        IKnowledgeBaseRepository kbRepo,
        IKnowledgeDocumentRepository docRepo,
        IUnitOfWork uow)
    {
        _kbRepo = kbRepo;
        _docRepo = docRepo;
        _uow = uow;
    }

    public async Task<KnowledgeDocumentDto> Handle(UploadDocumentCommand cmd, CancellationToken ct)
    {
        foreach (var kbId in cmd.KnowledgeBaseIds)
        {
            _ = await _kbRepo.GetByIdAsync(kbId, ct)
                ?? throw new NotFoundException(nameof(KnowledgeBase), kbId);
        }

        var fileType = Enum.Parse<FileType>(cmd.FileType);

        var document = KnowledgeDocument.Create(
            cmd.Title,
            fileType,
            cmd.FileSizeMb,
            cmd.ContentSummary,
            cmd.Note,
            cmd.UploadedBy,
            cmd.StoragePath);

        await _docRepo.AddAsync(document, ct);

        foreach (var kbId in cmd.KnowledgeBaseIds)
            await _docRepo.AddToKnowledgeBaseAsync(document.Id, kbId, ct);

        await _uow.SaveChangesAsync(ct);

        // Reload để trả về KnowledgeBases đã được link
        var saved = await _docRepo.GetByIdAsync(document.Id, ct);
        return saved!.Adapt<KnowledgeDocumentDto>();
    }
}

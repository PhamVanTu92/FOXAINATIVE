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
        string? kbName = null;
        if (cmd.KnowledgeBaseId.HasValue)
        {
            var kb = await _kbRepo.GetByIdAsync(cmd.KnowledgeBaseId.Value, ct)
                ?? throw new NotFoundException(nameof(KnowledgeBase), cmd.KnowledgeBaseId.Value);
            kbName = kb.Name;
        }

        var fileType = Enum.Parse<FileType>(cmd.FileType);

        var document = KnowledgeDocument.Create(
            cmd.KnowledgeBaseId,
            kbName,
            cmd.Title,
            fileType,
            cmd.FileSizeMb,
            cmd.ContentSummary,
            cmd.Note,
            cmd.UploadedBy,
            cmd.StoragePath);

        await _docRepo.AddAsync(document, ct);
        await _uow.SaveChangesAsync(ct);

        return document.Adapt<KnowledgeDocumentDto>();
    }
}

using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using KnowledgeService.Domain.Entities;
using Mapster;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.Archive;

public class ArchiveDocumentCommandHandler : IRequestHandler<ArchiveDocumentCommand, KnowledgeDocumentDto>
{
    private readonly IKnowledgeDocumentRepository _repo;
    private readonly IUnitOfWork _uow;

    public ArchiveDocumentCommandHandler(IKnowledgeDocumentRepository repo, IUnitOfWork uow)
    {
        _repo = repo;
        _uow = uow;
    }

    public async Task<KnowledgeDocumentDto> Handle(ArchiveDocumentCommand cmd, CancellationToken ct)
    {
        var doc = await _repo.GetByIdAsync(cmd.Id, ct)
            ?? throw new NotFoundException(nameof(KnowledgeDocument), cmd.Id);

        doc.Archive();
        _repo.Update(doc);
        await _uow.SaveChangesAsync(ct);

        return doc.Adapt<KnowledgeDocumentDto>();
    }
}

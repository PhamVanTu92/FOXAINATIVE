using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using KnowledgeService.Domain.Entities;
using Mapster;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.RequestRevision;

public class RequestDocumentRevisionCommandHandler
    : IRequestHandler<RequestDocumentRevisionCommand, KnowledgeDocumentDto>
{
    private readonly IKnowledgeDocumentRepository _repo;
    private readonly IUnitOfWork _uow;

    public RequestDocumentRevisionCommandHandler(IKnowledgeDocumentRepository repo, IUnitOfWork uow)
    {
        _repo = repo;
        _uow = uow;
    }

    public async Task<KnowledgeDocumentDto> Handle(RequestDocumentRevisionCommand cmd, CancellationToken ct)
    {
        var doc = await _repo.GetByIdAsync(cmd.Id, ct)
            ?? throw new NotFoundException(nameof(KnowledgeDocument), cmd.Id);

        doc.RequestRevision(cmd.RevisionNote);
        _repo.Update(doc);
        await _uow.SaveChangesAsync(ct);

        return doc.Adapt<KnowledgeDocumentDto>();
    }
}

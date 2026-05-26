using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using KnowledgeService.Domain.Entities;
using Mapster;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.ReturnToDraft;

public class ReturnDocumentToDraftCommandHandler
    : IRequestHandler<ReturnDocumentToDraftCommand, KnowledgeDocumentDto>
{
    private readonly IKnowledgeDocumentRepository _repo;
    private readonly IUnitOfWork _uow;

    public ReturnDocumentToDraftCommandHandler(IKnowledgeDocumentRepository repo, IUnitOfWork uow)
    {
        _repo = repo;
        _uow = uow;
    }

    public async Task<KnowledgeDocumentDto> Handle(ReturnDocumentToDraftCommand cmd, CancellationToken ct)
    {
        var doc = await _repo.GetByIdAsync(cmd.Id, ct)
            ?? throw new NotFoundException(nameof(KnowledgeDocument), cmd.Id);

        doc.ReturnToDraft();
        _repo.Update(doc);
        await _uow.SaveChangesAsync(ct);

        return doc.Adapt<KnowledgeDocumentDto>();
    }
}

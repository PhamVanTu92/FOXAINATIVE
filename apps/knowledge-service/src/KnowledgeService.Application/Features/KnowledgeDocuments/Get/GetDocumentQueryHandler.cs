using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using KnowledgeService.Domain.Entities;
using Mapster;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.Get;

public class GetDocumentQueryHandler : IRequestHandler<GetDocumentQuery, KnowledgeDocumentDetailDto>
{
    private readonly IKnowledgeDocumentRepository _repo;

    public GetDocumentQueryHandler(IKnowledgeDocumentRepository repo) => _repo = repo;

    public async Task<KnowledgeDocumentDetailDto> Handle(GetDocumentQuery query, CancellationToken ct)
    {
        var doc = await _repo.GetByIdWithVersionsAsync(query.Id, ct)
            ?? throw new NotFoundException(nameof(KnowledgeDocument), query.Id);

        return doc.Adapt<KnowledgeDocumentDetailDto>();
    }
}

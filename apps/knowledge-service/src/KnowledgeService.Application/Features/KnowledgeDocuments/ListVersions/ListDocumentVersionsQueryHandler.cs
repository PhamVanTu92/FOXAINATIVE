using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using Mapster;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.ListVersions;

public class ListDocumentVersionsQueryHandler
    : IRequestHandler<ListDocumentVersionsQuery, List<KnowledgeDocumentVersionDto>>
{
    private readonly IKnowledgeDocumentRepository _repo;

    public ListDocumentVersionsQueryHandler(IKnowledgeDocumentRepository repo) => _repo = repo;

    public async Task<List<KnowledgeDocumentVersionDto>> Handle(
        ListDocumentVersionsQuery query, CancellationToken ct)
    {
        var versions = await _repo.ListVersionsAsync(query.DocumentId, ct);
        return versions.Adapt<List<KnowledgeDocumentVersionDto>>();
    }
}

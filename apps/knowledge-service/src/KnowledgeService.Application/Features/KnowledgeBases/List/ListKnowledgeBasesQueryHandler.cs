using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Features.KnowledgeBases.Dtos;
using Mapster;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeBases.List;

public class ListKnowledgeBasesQueryHandler : IRequestHandler<ListKnowledgeBasesQuery, PagedResult<KnowledgeBaseDto>>
{
    private readonly IKnowledgeBaseRepository _repo;

    public ListKnowledgeBasesQueryHandler(IKnowledgeBaseRepository repo) => _repo = repo;

    public async Task<PagedResult<KnowledgeBaseDto>> Handle(ListKnowledgeBasesQuery query, CancellationToken ct)
    {
        var (items, total) = await _repo.ListAsync(query.Search, query.DepartmentId, query.Page, query.PageSize, ct);

        return new PagedResult<KnowledgeBaseDto>
        {
            Items = items.Adapt<List<KnowledgeBaseDto>>(),
            Total = total,
            Page = query.Page,
            PageSize = query.PageSize
        };
    }
}

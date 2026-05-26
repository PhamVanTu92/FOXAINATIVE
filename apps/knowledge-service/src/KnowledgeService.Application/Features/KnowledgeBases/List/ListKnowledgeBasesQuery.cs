using KnowledgeService.Application.Features.KnowledgeBases.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeBases.List;

public record ListKnowledgeBasesQuery(
    string? Search,
    Guid? DepartmentId,
    int Page = 1,
    int PageSize = 20
) : IRequest<PagedResult<KnowledgeBaseDto>>;

public class PagedResult<T>
{
    public IReadOnlyList<T> Items { get; set; } = Array.Empty<T>();
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

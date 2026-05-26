using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Features.KnowledgeBases.List;
using KnowledgeService.Application.Features.KnowledgeFiles.Dtos;
using KnowledgeService.Domain.Enums;
using Mapster;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeFiles.List;

public class ListKnowledgeFilesQueryHandler : IRequestHandler<ListKnowledgeFilesQuery, PagedResult<KnowledgeFileDto>>
{
    private readonly IKnowledgeFileRepository _repo;

    public ListKnowledgeFilesQueryHandler(IKnowledgeFileRepository repo) => _repo = repo;

    public async Task<PagedResult<KnowledgeFileDto>> Handle(ListKnowledgeFilesQuery query, CancellationToken ct)
    {
        FileType? fileType = null;
        if (!string.IsNullOrEmpty(query.FileType) && Enum.TryParse<FileType>(query.FileType, out var ft))
            fileType = ft;

        var (items, total) = await _repo.ListAsync(
            query.KnowledgeBaseId, query.Search, fileType, query.Page, query.PageSize, ct);

        return new PagedResult<KnowledgeFileDto>
        {
            Items = items.Adapt<List<KnowledgeFileDto>>(),
            Total = total,
            Page = query.Page,
            PageSize = query.PageSize
        };
    }
}

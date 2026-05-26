using KnowledgeService.Application.Features.KnowledgeBases.List;
using KnowledgeService.Application.Features.KnowledgeFiles.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeFiles.List;

public record ListKnowledgeFilesQuery(
    Guid KnowledgeBaseId,
    string? Search,
    string? FileType,
    int Page = 1,
    int PageSize = 50
) : IRequest<PagedResult<KnowledgeFileDto>>;

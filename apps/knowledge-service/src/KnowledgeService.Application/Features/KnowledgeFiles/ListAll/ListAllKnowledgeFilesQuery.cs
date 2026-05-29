using KnowledgeService.Application.Features.KnowledgeFiles.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeFiles.ListAll;

public record ListAllKnowledgeFilesQuery(
    string? Search,
    string? FileType,
    int Page = 1,
    int PageSize = 50
) : IRequest<AllFilesResultDto>;

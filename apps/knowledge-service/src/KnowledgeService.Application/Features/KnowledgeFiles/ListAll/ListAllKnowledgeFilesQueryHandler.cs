using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Features.KnowledgeFiles.Dtos;
using KnowledgeService.Domain.Enums;
using Mapster;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeFiles.ListAll;

public class ListAllKnowledgeFilesQueryHandler : IRequestHandler<ListAllKnowledgeFilesQuery, AllFilesResultDto>
{
    private readonly IKnowledgeFileRepository _repo;

    public ListAllKnowledgeFilesQueryHandler(IKnowledgeFileRepository repo) => _repo = repo;

    public async Task<AllFilesResultDto> Handle(ListAllKnowledgeFilesQuery query, CancellationToken ct)
    {
        FileType? fileType = null;
        if (!string.IsNullOrEmpty(query.FileType) && Enum.TryParse<FileType>(query.FileType, out var ft))
            fileType = ft;

        var (items, total, typeCounts) = await _repo.ListAllAsync(
            query.Search, fileType, query.Page, query.PageSize, ct);

        return new AllFilesResultDto
        {
            Items = items.Adapt<List<KnowledgeFileDto>>(),
            Total = total,
            Page = query.Page,
            PageSize = query.PageSize,
            Counts = new AllFileCountsDto
            {
                Word = typeCounts.GetValueOrDefault(FileType.Word),
                Excel = typeCounts.GetValueOrDefault(FileType.Excel),
                Pdf = typeCounts.GetValueOrDefault(FileType.PDF),
                Image = typeCounts.GetValueOrDefault(FileType.Image),
                PowerPoint = typeCounts.GetValueOrDefault(FileType.PowerPoint),
                Text = typeCounts.GetValueOrDefault(FileType.Text),
                Total = typeCounts.Values.Sum()
            }
        };
    }
}

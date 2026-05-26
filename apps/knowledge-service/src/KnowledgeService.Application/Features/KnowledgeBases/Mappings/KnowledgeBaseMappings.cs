using KnowledgeService.Application.Features.KnowledgeBases.Dtos;
using KnowledgeService.Domain.Entities;
using KnowledgeService.Domain.Enums;
using Mapster;

namespace KnowledgeService.Application.Features.KnowledgeBases.Mappings;

public class KnowledgeBaseMappings : IRegister
{
    public void Register(TypeAdapterConfig config)
    {
        config.NewConfig<KnowledgeBase, KnowledgeBaseDto>()
            .Map(dest => dest.Permissions, src => src.Permissions.Select(p => new DepartmentRefDto
            {
                DepartmentId = p.DepartmentId,
                DepartmentName = p.DepartmentName
            }).ToList())
            .Map(dest => dest.TotalFiles, src => src.Files.Count)
            .Map(dest => dest.FileCounts, src => new FileCountsDto
            {
                Word = src.Files.Count(f => f.FileType == FileType.Word),
                Excel = src.Files.Count(f => f.FileType == FileType.Excel),
                Pdf = src.Files.Count(f => f.FileType == FileType.PDF),
                Image = src.Files.Count(f => f.FileType == FileType.Image)
            });
    }
}

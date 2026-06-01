using KnowledgeService.Application.Features.KnowledgeBases.Dtos;
using KnowledgeService.Application.Features.KnowledgeFiles.Dtos;
using KnowledgeService.Domain.Entities;
using Mapster;

namespace KnowledgeService.Application.Features.KnowledgeFiles.Mappings;

public class KnowledgeFileMappings : IRegister
{
    public void Register(TypeAdapterConfig config)
    {
        config.NewConfig<KnowledgeFile, KnowledgeFileDto>()
            .Map(dest => dest.KnowledgeBases, src => src.KnowledgeBases.Select(kb => new KnowledgeBaseRefDto
            {
                Id = kb.Id,
                Name = kb.Name
            }).ToList())
            .Map(dest => dest.FileType, src => src.FileType.ToString())
            .Map(dest => dest.Permissions, src => src.Permissions.Select(p => new DepartmentRefDto
            {
                DepartmentId = p.DepartmentId,
                DepartmentName = p.DepartmentName
            }).ToList());
    }
}

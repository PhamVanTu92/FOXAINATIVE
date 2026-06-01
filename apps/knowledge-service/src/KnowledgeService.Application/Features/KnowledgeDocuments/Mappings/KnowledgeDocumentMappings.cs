using KnowledgeService.Application.Features.KnowledgeBases.Dtos;
using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using KnowledgeService.Domain.Entities;
using Mapster;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.Mappings;

public class KnowledgeDocumentMappings : IRegister
{
    public void Register(TypeAdapterConfig config)
    {
        config.NewConfig<KnowledgeDocument, KnowledgeDocumentDto>()
            .Map(dest => dest.KnowledgeBases, src => src.KnowledgeBases.Select(kb => new KnowledgeBaseRefDto
            {
                Id = kb.Id,
                Name = kb.Name
            }).ToList())
            .Map(dest => dest.FileType, src => src.FileType.ToString())
            .Map(dest => dest.Status, src => src.Status.ToString())
            .Map(dest => dest.UploadedBy,
                src => src.UploadedBy.HasValue ? src.UploadedBy.Value.ToString() : null);

        config.NewConfig<KnowledgeDocument, KnowledgeDocumentDetailDto>()
            .Map(dest => dest.KnowledgeBases, src => src.KnowledgeBases.Select(kb => new KnowledgeBaseRefDto
            {
                Id = kb.Id,
                Name = kb.Name
            }).ToList())
            .Map(dest => dest.FileType, src => src.FileType.ToString())
            .Map(dest => dest.Status, src => src.Status.ToString())
            .Map(dest => dest.UploadedBy,
                src => src.UploadedBy.HasValue ? src.UploadedBy.Value.ToString() : null)
            .Map(dest => dest.Versions,
                src => src.Versions.OrderBy(v => v.CreatedAt).ToList());

        config.NewConfig<KnowledgeDocumentVersion, KnowledgeDocumentVersionDto>()
            .Map(dest => dest.Status, src => src.Status.ToString())
            .Map(dest => dest.CreatedBy,
                src => src.CreatedBy.HasValue ? src.CreatedBy.Value.ToString() : null);
    }
}

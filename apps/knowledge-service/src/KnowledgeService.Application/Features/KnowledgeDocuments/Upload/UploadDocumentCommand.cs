using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.Upload;

public record UploadDocumentCommand(
    Guid KnowledgeBaseId,
    string Title,
    string FileType,
    decimal FileSizeMb,
    string? ContentSummary,
    string? Note,
    Guid? UploadedBy,
    string? StoragePath = null
) : IRequest<KnowledgeDocumentDto>;

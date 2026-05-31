using KnowledgeService.Application.Features.KnowledgeBases.Dtos;
using KnowledgeService.Application.Features.KnowledgeFiles.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeFiles.Add;

public record AddKnowledgeFileCommand(
    Guid? KnowledgeBaseId,
    string FileName,
    string FileType,
    decimal FileSizeMb,
    List<DepartmentRefDto> PermittedDepartments,
    Guid? UploadedBy,
    string? StoragePath = null
) : IRequest<KnowledgeFileDto>;

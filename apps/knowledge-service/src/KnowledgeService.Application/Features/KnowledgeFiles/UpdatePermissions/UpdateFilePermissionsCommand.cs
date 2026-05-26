using KnowledgeService.Application.Features.KnowledgeBases.Dtos;
using KnowledgeService.Application.Features.KnowledgeFiles.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeFiles.UpdatePermissions;

public record UpdateFilePermissionsCommand(
    Guid Id,
    Guid KnowledgeBaseId,
    List<DepartmentRefDto> PermittedDepartments
) : IRequest<KnowledgeFileDto>;

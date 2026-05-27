using KnowledgeService.Application.Features.KnowledgeBases.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeBases.Create;

public record CreateKnowledgeBaseCommand(
    string Code,
    string Name,
    string? Description,
    Guid ManagingDepartmentId,
    string ManagingDepartmentName,
    List<DepartmentRefDto> PermittedDepartments,
    Guid? CreatedBy
) : IRequest<KnowledgeBaseDto>;

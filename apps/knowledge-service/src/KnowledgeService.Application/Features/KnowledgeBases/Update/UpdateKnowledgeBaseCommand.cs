using KnowledgeService.Application.Features.KnowledgeBases.Dtos;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeBases.Update;

public record UpdateKnowledgeBaseCommand(
    Guid Id,
    string Name,
    string? Description,
    Guid ManagingDepartmentId,
    string ManagingDepartmentName,
    List<DepartmentRefDto> PermittedDepartments
) : IRequest<KnowledgeBaseDto>;

using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Application.Features.KnowledgeBases.Dtos;
using KnowledgeService.Domain.Entities;
using Mapster;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeBases.Create;

public class CreateKnowledgeBaseCommandHandler : IRequestHandler<CreateKnowledgeBaseCommand, KnowledgeBaseDto>
{
    private readonly IKnowledgeBaseRepository _repo;
    private readonly IUnitOfWork _uow;

    public CreateKnowledgeBaseCommandHandler(IKnowledgeBaseRepository repo, IUnitOfWork uow)
    {
        _repo = repo;
        _uow = uow;
    }

    public async Task<KnowledgeBaseDto> Handle(CreateKnowledgeBaseCommand cmd, CancellationToken ct)
    {
        if (await _repo.ExistsByCodeAsync(cmd.Code, ct))
            throw new ConflictException($"Mã bộ tri thức '{cmd.Code}' đã tồn tại.");

        var now = DateTime.UtcNow;
        var kb = new KnowledgeBase
        {
            Code = cmd.Code.ToUpperInvariant(),
            Name = cmd.Name,
            Description = cmd.Description,
            ManagingDepartmentId = cmd.ManagingDepartmentId,
            ManagingDepartmentName = cmd.ManagingDepartmentName,
            CreatedBy = cmd.CreatedBy,
            CreatedAt = now,
            UpdatedAt = now,
            Permissions = cmd.PermittedDepartments.Select(d => new KnowledgeBasePermission
            {
                DepartmentId = d.DepartmentId,
                DepartmentName = d.DepartmentName,
                CreatedAt = now,
                UpdatedAt = now
            }).ToList()
        };

        await _repo.AddAsync(kb, ct);
        await _uow.SaveChangesAsync(ct);

        return kb.Adapt<KnowledgeBaseDto>();
    }
}

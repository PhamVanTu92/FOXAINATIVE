using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Common.Exceptions;
using KnowledgeService.Application.Features.KnowledgeBases.Dtos;
using KnowledgeService.Domain.Entities;
using Mapster;
using MediatR;
using Microsoft.Extensions.Logging;

namespace KnowledgeService.Application.Features.KnowledgeBases.Update;

public class UpdateKnowledgeBaseCommandHandler : IRequestHandler<UpdateKnowledgeBaseCommand, KnowledgeBaseDto>
{
    private readonly IKnowledgeBaseRepository _repo;
    private readonly IUnitOfWork _uow;
    private readonly IIndexServiceClient _indexServiceClient;
    private readonly ILogger<UpdateKnowledgeBaseCommandHandler> _logger;

    public UpdateKnowledgeBaseCommandHandler(
        IKnowledgeBaseRepository repo,
        IUnitOfWork uow,
        IIndexServiceClient indexServiceClient,
        ILogger<UpdateKnowledgeBaseCommandHandler> logger)
    {
        _repo = repo;
        _uow = uow;
        _indexServiceClient = indexServiceClient;
        _logger = logger;
    }

    public async Task<KnowledgeBaseDto> Handle(UpdateKnowledgeBaseCommand cmd, CancellationToken ct)
    {
        var kb = await _repo.GetByIdAsync(cmd.Id, ct)
            ?? throw new NotFoundException(nameof(KnowledgeBase), cmd.Id);

        var now = DateTime.UtcNow;
        kb.Name = cmd.Name;
        kb.Description = cmd.Description;
        kb.ManagingDepartmentId = cmd.ManagingDepartmentId;
        kb.ManagingDepartmentName = cmd.ManagingDepartmentName;
        kb.UpdatedAt = now;

        // Xóa permission cũ qua DbSet.RemoveRange → đảm bảo trạng thái Deleted
        _repo.RemovePermissions(kb.Permissions.ToList());

        // Thêm permission mới qua DbSet.AddRange → đảm bảo trạng thái Added
        var newPermissions = cmd.PermittedDepartments.Select(d => new KnowledgeBasePermission
        {
            KnowledgeBaseId = kb.Id,
            DepartmentId = d.DepartmentId,
            DepartmentName = d.DepartmentName,
            CreatedAt = now,
            UpdatedAt = now
        }).ToList();
        await _repo.AddPermissionsAsync(newPermissions, ct);

        await _uow.SaveChangesAsync(ct);

        // Đồng bộ tên và mô tả sang index-service nếu KB đã có collection (best-effort)
        if (kb.CollectionId.HasValue)
        {
            _logger.LogInformation(
                "UpdateKnowledgeBase → syncing index-service collectionId={CollectionId}, name='{Name}'",
                kb.CollectionId.Value, kb.Name);
            await _indexServiceClient.UpdateCollectionAsync(kb.CollectionId.Value, kb.Name, kb.Description, ct);
        }
        else
        {
            _logger.LogInformation(
                "UpdateKnowledgeBase → SKIP index-service sync: KB {KbId} has no CollectionId", kb.Id);
        }

        kb.Permissions = newPermissions;
        return kb.Adapt<KnowledgeBaseDto>();
    }
}

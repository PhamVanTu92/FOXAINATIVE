using KnowledgeService.Domain.Common;

namespace KnowledgeService.Domain.Entities;

/// <summary>Bộ tri thức – nhóm tài liệu theo chủ đề/phòng ban.</summary>
public class KnowledgeBase : BaseEntity, IAggregateRoot
{
    /// <summary>Mã duy nhất, không thay đổi sau khi tạo. VD: KB001</summary>
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }

    /// <summary>ID phòng ban quản lý (tham chiếu sang system-service, không FK cứng).</summary>
    public Guid ManagingDepartmentId { get; set; }
    public string ManagingDepartmentName { get; set; } = default!;

    /// <summary>Người tạo (userId từ system-service).</summary>
    public Guid? CreatedBy { get; set; }

    /// <summary>ID collection tương ứng trong index-service (null nếu chưa đồng bộ).</summary>
    public Guid? CollectionId { get; set; }

    public ICollection<KnowledgeBasePermission> Permissions { get; set; } = new List<KnowledgeBasePermission>();
    public ICollection<KnowledgeFile> Files { get; set; } = new List<KnowledgeFile>();
}

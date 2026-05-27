using KnowledgeService.Domain.Common;

namespace KnowledgeService.Domain.Entities;

/// <summary>Phân quyền truy cập bộ tri thức theo phòng ban.</summary>
public class KnowledgeBasePermission : BaseEntity
{
    public Guid KnowledgeBaseId { get; set; }
    public KnowledgeBase KnowledgeBase { get; set; } = default!;

    /// <summary>ID phòng ban (tham chiếu sang system-service, không FK cứng).</summary>
    public Guid DepartmentId { get; set; }
    public string DepartmentName { get; set; } = default!;
}

using KnowledgeService.Domain.Common;

namespace KnowledgeService.Domain.Entities;

/// <summary>Phân quyền truy cập tệp tri thức theo phòng ban (ghi đè phân quyền bộ tri thức).</summary>
public class KnowledgeFilePermission : BaseEntity
{
    public Guid KnowledgeFileId { get; set; }
    public KnowledgeFile KnowledgeFile { get; set; } = default!;

    /// <summary>ID phòng ban (tham chiếu sang system-service, không FK cứng).</summary>
    public Guid DepartmentId { get; set; }
    public string DepartmentName { get; set; } = default!;
}

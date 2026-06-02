using KnowledgeService.Domain.Common;
using KnowledgeService.Domain.Enums;

namespace KnowledgeService.Domain.Entities;

/// <summary>Tệp tri thức thuộc một bộ tri thức.</summary>
public class KnowledgeFile : BaseEntity
{
    public Guid? KnowledgeBaseId { get; set; }
    public KnowledgeBase? KnowledgeBase { get; set; }

    public string FileName { get; set; } = default!;
    public FileType FileType { get; set; }

    /// <summary>Kích thước tệp tính bằng MB (metadata nhập tay giai đoạn 1).</summary>
    public decimal FileSizeMb { get; set; }

    /// <summary>Đường dẫn lưu trữ vật lý (MinIO/S3 – giai đoạn 2).</summary>
    public string? StoragePath { get; set; }

    /// <summary>Người tải lên (userId từ system-service).</summary>
    public Guid? UploadedBy { get; set; }
    public DateTime UploadedAt { get; set; }

    /// <summary>ID tài liệu nguồn — được set khi file tự động tạo lúc duyệt KnowledgeDocument.</summary>
    public Guid? SourceDocumentId { get; set; }

    /// <summary>ID tài liệu trong index-service — được set sau khi file được đẩy sang index-service thành công.</summary>
    public Guid? DocumentIndexId { get; set; }

    public ICollection<KnowledgeFilePermission> Permissions { get; set; } = new List<KnowledgeFilePermission>();
}

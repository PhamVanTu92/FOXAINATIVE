namespace KnowledgeService.Application.Common.Abstractions;

public interface IIndexServiceClient
{
    /// <summary>Tạo collection trong index-service. Trả về collection_id hoặc null nếu lỗi.</summary>
    Task<Guid?> CreateCollectionAsync(string collectionName, string? description, CancellationToken ct = default);

    /// <summary>Cập nhật tên và mô tả collection trong index-service. Trả về true nếu thành công.</summary>
    Task<bool> UpdateCollectionAsync(Guid collectionId, string collectionName, string? description, CancellationToken ct = default);

    /// <summary>Xóa document khỏi index-service theo document_id. Trả về true nếu thành công hoặc không tồn tại.</summary>
    Task<bool> DeleteDocumentAsync(Guid documentId, CancellationToken ct = default);

    /// <summary>Upload file và xử lý (batch-upload + batch-process) vào collection. Trả về document_id từ index-service hoặc null nếu lỗi.</summary>
    Task<Guid?> UploadAndProcessDocumentAsync(
        Guid collectionId,
        string fileUrl,
        string fileName,
        string fileExtension,
        string version,
        CancellationToken ct = default);
}

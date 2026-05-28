namespace KnowledgeService.Application.Common.Abstractions;

public interface IIndexServiceClient
{
    /// <summary>Tạo collection trong index-service. Trả về collection_id hoặc null nếu lỗi.</summary>
    Task<Guid?> CreateCollectionAsync(string collectionName, string? description, CancellationToken ct = default);

    /// <summary>Upload file và xử lý (batch-upload + batch-process) vào collection.</summary>
    Task UploadAndProcessDocumentAsync(
        Guid collectionId,
        string fileUrl,
        string fileName,
        string fileExtension,
        string version,
        CancellationToken ct = default);
}

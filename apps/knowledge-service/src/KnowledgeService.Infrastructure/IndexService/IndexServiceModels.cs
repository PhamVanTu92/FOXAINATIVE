using System.Text.Json.Serialization;

namespace KnowledgeService.Infrastructure.IndexService;

internal sealed class CreateCollectionResponse
{
    [JsonPropertyName("info")]
    public CreateCollectionInfo? Info { get; set; }
}

internal sealed class CreateCollectionInfo
{
    [JsonPropertyName("collection_id")]
    public Guid? CollectionId { get; set; }
}

internal sealed class BatchUploadResponse
{
    [JsonPropertyName("info")]
    public BatchUploadInfo? Info { get; set; }
}

internal sealed class BatchUploadInfo
{
    [JsonPropertyName("documents")]
    public List<UploadedDocument> Documents { get; set; } = new();
}

internal sealed class UploadedDocument
{
    [JsonPropertyName("document_id")]
    public string? DocumentId { get; set; }
}

namespace KnowledgeService.Application.Common.Abstractions;

public record IndexingTask(
    Guid CollectionId,
    string StoragePath,
    string FileName,
    string FileExtension,
    string Version);

public interface IIndexingQueue
{
    void Enqueue(IndexingTask task);
    ValueTask<IndexingTask> DequeueAsync(CancellationToken ct);
}

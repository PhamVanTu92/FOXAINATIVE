using System.Threading.Channels;
using KnowledgeService.Application.Common.Abstractions;

namespace KnowledgeService.Infrastructure.IndexService;

public class InMemoryIndexingQueue : IIndexingQueue
{
    private readonly Channel<IndexingTask> _channel =
        Channel.CreateUnbounded<IndexingTask>(new UnboundedChannelOptions { SingleReader = true });

    public void Enqueue(IndexingTask task) => _channel.Writer.TryWrite(task);

    public ValueTask<IndexingTask> DequeueAsync(CancellationToken ct) =>
        _channel.Reader.ReadAsync(ct);
}

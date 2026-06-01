using KnowledgeService.Application.Common.Abstractions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace KnowledgeService.Infrastructure.IndexService;

public class IndexingWorker : BackgroundService
{
    private readonly IIndexingQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<IndexingWorker> _logger;

    public IndexingWorker(
        IIndexingQueue queue,
        IServiceScopeFactory scopeFactory,
        ILogger<IndexingWorker> logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            IndexingTask task;
            try
            {
                task = await _queue.DequeueAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var client = scope.ServiceProvider.GetRequiredService<IIndexServiceClient>();

                _logger.LogInformation(
                    "IndexingWorker → processing collectionId={CollectionId}, file={FileName}, ext={Ext}, version={Version}",
                    task.CollectionId, task.FileName, task.FileExtension, task.Version);

                await client.UploadAndProcessDocumentAsync(
                    task.CollectionId,
                    task.StoragePath,
                    task.FileName,
                    task.FileExtension,
                    task.Version,
                    stoppingToken);

                _logger.LogInformation(
                    "IndexingWorker → done collectionId={CollectionId}, file={FileName}",
                    task.CollectionId, task.FileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "IndexingWorker → failed collectionId={CollectionId}, file={FileName}",
                    task.CollectionId, task.FileName);
            }
        }
    }
}

using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Infrastructure.Helpers;
using KnowledgeService.Infrastructure.Persistence;
using KnowledgeService.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace KnowledgeService.Infrastructure;

public static class InfrastructureServiceExtensions
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        var url = config["KNOWLEDGE_DATABASE_URL"]
                  ?? config.GetConnectionString("KnowledgeDb")
                  ?? throw new InvalidOperationException("KNOWLEDGE_DATABASE_URL is required.");

        var connStr = PostgresUrlParser.ToNpgsqlConnectionString(url);

        services.AddDbContext<KnowledgeDbContext>(opts =>
            opts.UseNpgsql(connStr)
                .UseSnakeCaseNamingConvention());

        services.AddScoped<IKnowledgeBaseRepository, KnowledgeBaseRepository>();
        services.AddScoped<IKnowledgeFileRepository, KnowledgeFileRepository>();
        services.AddScoped<IKnowledgeDocumentRepository, KnowledgeDocumentRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        return services;
    }
}

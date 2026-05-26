using KnowledgeService.Infrastructure.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace KnowledgeService.Infrastructure.Persistence;

public class KnowledgeDbContextFactory : IDesignTimeDbContextFactory<KnowledgeDbContext>
{
    public KnowledgeDbContext CreateDbContext(string[] args)
    {
        DotNetEnv.Env.TraversePath().Load();
        var url = Environment.GetEnvironmentVariable("KNOWLEDGE_DATABASE_URL")
                  ?? "postgresql://kb_user:kb_pass@localhost:5435/knowledge_db";
        var connStr = PostgresUrlParser.ToNpgsqlConnectionString(url);

        var opts = new DbContextOptionsBuilder<KnowledgeDbContext>()
            .UseNpgsql(connStr)
            .UseSnakeCaseNamingConvention()
            .Options;

        return new KnowledgeDbContext(opts);
    }
}

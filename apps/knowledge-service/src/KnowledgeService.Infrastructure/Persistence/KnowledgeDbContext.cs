using KnowledgeService.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace KnowledgeService.Infrastructure.Persistence;

public class KnowledgeDbContext : DbContext
{
    public KnowledgeDbContext(DbContextOptions<KnowledgeDbContext> options) : base(options) { }

    public DbSet<KnowledgeBase> KnowledgeBases => Set<KnowledgeBase>();
    public DbSet<KnowledgeBasePermission> KnowledgeBasePermissions => Set<KnowledgeBasePermission>();
    public DbSet<KnowledgeFile> KnowledgeFiles => Set<KnowledgeFile>();
    public DbSet<KnowledgeBaseFile> KnowledgeBaseFiles => Set<KnowledgeBaseFile>();
    public DbSet<KnowledgeFilePermission> KnowledgeFilePermissions => Set<KnowledgeFilePermission>();
    public DbSet<KnowledgeDocument> KnowledgeDocuments => Set<KnowledgeDocument>();
    public DbSet<KnowledgeBaseDocument> KnowledgeBaseDocuments => Set<KnowledgeBaseDocument>();
    public DbSet<KnowledgeDocumentVersion> KnowledgeDocumentVersions => Set<KnowledgeDocumentVersion>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(KnowledgeDbContext).Assembly);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<KnowledgeService.Domain.Common.BaseEntity>())
        {
            if (entry.State == EntityState.Added)
                entry.Entity.CreatedAt = entry.Entity.UpdatedAt = now;
            else if (entry.State == EntityState.Modified)
                entry.Entity.UpdatedAt = now;
        }
        return base.SaveChangesAsync(cancellationToken);
    }
}

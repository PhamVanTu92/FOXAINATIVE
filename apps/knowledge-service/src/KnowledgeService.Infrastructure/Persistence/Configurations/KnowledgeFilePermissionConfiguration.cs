using KnowledgeService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace KnowledgeService.Infrastructure.Persistence.Configurations;

public class KnowledgeFilePermissionConfiguration : IEntityTypeConfiguration<KnowledgeFilePermission>
{
    public void Configure(EntityTypeBuilder<KnowledgeFilePermission> builder)
    {
        builder.ToTable("knowledge_file_permissions");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.DepartmentName).IsRequired().HasMaxLength(200);

        builder.HasIndex(x => x.KnowledgeFileId);
        builder.HasIndex(x => x.DepartmentId);
    }
}

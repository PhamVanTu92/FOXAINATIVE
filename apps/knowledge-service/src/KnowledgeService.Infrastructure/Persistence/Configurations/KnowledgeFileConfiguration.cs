using KnowledgeService.Domain.Entities;
using KnowledgeService.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace KnowledgeService.Infrastructure.Persistence.Configurations;

public class KnowledgeFileConfiguration : IEntityTypeConfiguration<KnowledgeFile>
{
    public void Configure(EntityTypeBuilder<KnowledgeFile> builder)
    {
        builder.ToTable("knowledge_files");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.FileName).IsRequired().HasMaxLength(500);
        builder.Property(x => x.FileType).HasConversion<string>().IsRequired();
        builder.Property(x => x.FileSizeMb).HasColumnType("decimal(10,4)");
        builder.Property(x => x.StoragePath).HasMaxLength(1000);

        builder.HasIndex(x => x.KnowledgeBaseId);
        builder.HasIndex(x => x.FileType);
        builder.HasIndex(x => x.UploadedAt);
        builder.HasIndex(x => x.SourceDocumentId);
        builder.HasIndex(x => x.DocumentIndexId);

        builder.HasMany(x => x.Permissions)
               .WithOne(x => x.KnowledgeFile)
               .HasForeignKey(x => x.KnowledgeFileId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KnowledgeService.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddKnowledgeFileSourceDocument : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "source_document_id",
                table: "knowledge_files",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_files_source_document_id",
                table: "knowledge_files",
                column: "source_document_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_knowledge_files_source_document_id",
                table: "knowledge_files");

            migrationBuilder.DropColumn(
                name: "source_document_id",
                table: "knowledge_files");
        }
    }
}

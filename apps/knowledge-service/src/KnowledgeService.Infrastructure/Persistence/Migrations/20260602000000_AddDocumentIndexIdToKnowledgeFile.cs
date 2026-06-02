using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KnowledgeService.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentIndexIdToKnowledgeFile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "document_index_id",
                table: "knowledge_files",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_files_document_index_id",
                table: "knowledge_files",
                column: "document_index_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_knowledge_files_document_index_id",
                table: "knowledge_files");

            migrationBuilder.DropColumn(
                name: "document_index_id",
                table: "knowledge_files");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KnowledgeService.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddKnowledgeDocuments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "knowledge_documents",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    knowledge_base_id = table.Column<Guid>(type: "uuid", nullable: false),
                    knowledge_base_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    file_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    file_size_mb = table.Column<decimal>(type: "numeric(10,4)", nullable: false),
                    storage_path = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    uploaded_by = table.Column<Guid>(type: "uuid", nullable: true),
                    uploaded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    current_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    version_count = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_knowledge_documents", x => x.id);
                    table.ForeignKey(
                        name: "fk_knowledge_documents_knowledge_bases_knowledge_base_id",
                        column: x => x.knowledge_base_id,
                        principalTable: "knowledge_bases",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "knowledge_document_versions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    document_id = table.Column<Guid>(type: "uuid", nullable: false),
                    version_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    change_note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    content_summary = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_knowledge_document_versions", x => x.id);
                    table.ForeignKey(
                        name: "fk_knowledge_document_versions_knowledge_documents_document_id",
                        column: x => x.document_id,
                        principalTable: "knowledge_documents",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_document_versions_document_id",
                table: "knowledge_document_versions",
                column: "document_id");

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_documents_knowledge_base_id",
                table: "knowledge_documents",
                column: "knowledge_base_id");

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_documents_status",
                table: "knowledge_documents",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_documents_uploaded_at",
                table: "knowledge_documents",
                column: "uploaded_at");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "knowledge_document_versions");

            migrationBuilder.DropTable(
                name: "knowledge_documents");
        }
    }
}

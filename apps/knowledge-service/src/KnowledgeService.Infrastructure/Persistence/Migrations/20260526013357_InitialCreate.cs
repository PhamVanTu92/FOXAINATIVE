using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KnowledgeService.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "knowledge_bases",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    managing_department_id = table.Column<Guid>(type: "uuid", nullable: false),
                    managing_department_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_knowledge_bases", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "knowledge_base_permissions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    knowledge_base_id = table.Column<Guid>(type: "uuid", nullable: false),
                    department_id = table.Column<Guid>(type: "uuid", nullable: false),
                    department_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_knowledge_base_permissions", x => x.id);
                    table.ForeignKey(
                        name: "fk_knowledge_base_permissions_knowledge_bases_knowledge_base_id",
                        column: x => x.knowledge_base_id,
                        principalTable: "knowledge_bases",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "knowledge_files",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    knowledge_base_id = table.Column<Guid>(type: "uuid", nullable: false),
                    file_name = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    file_type = table.Column<string>(type: "text", nullable: false),
                    file_size_mb = table.Column<decimal>(type: "numeric(10,4)", nullable: false),
                    storage_path = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    uploaded_by = table.Column<Guid>(type: "uuid", nullable: true),
                    uploaded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_knowledge_files", x => x.id);
                    table.ForeignKey(
                        name: "fk_knowledge_files_knowledge_bases_knowledge_base_id",
                        column: x => x.knowledge_base_id,
                        principalTable: "knowledge_bases",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "knowledge_file_permissions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    knowledge_file_id = table.Column<Guid>(type: "uuid", nullable: false),
                    department_id = table.Column<Guid>(type: "uuid", nullable: false),
                    department_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_knowledge_file_permissions", x => x.id);
                    table.ForeignKey(
                        name: "fk_knowledge_file_permissions_knowledge_files_knowledge_file_id",
                        column: x => x.knowledge_file_id,
                        principalTable: "knowledge_files",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_base_permissions_department_id",
                table: "knowledge_base_permissions",
                column: "department_id");

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_base_permissions_knowledge_base_id",
                table: "knowledge_base_permissions",
                column: "knowledge_base_id");

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_bases_code",
                table: "knowledge_bases",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_bases_managing_department_id",
                table: "knowledge_bases",
                column: "managing_department_id");

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_bases_updated_at",
                table: "knowledge_bases",
                column: "updated_at");

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_file_permissions_department_id",
                table: "knowledge_file_permissions",
                column: "department_id");

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_file_permissions_knowledge_file_id",
                table: "knowledge_file_permissions",
                column: "knowledge_file_id");

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_files_file_type",
                table: "knowledge_files",
                column: "file_type");

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_files_knowledge_base_id",
                table: "knowledge_files",
                column: "knowledge_base_id");

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_files_uploaded_at",
                table: "knowledge_files",
                column: "uploaded_at");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "knowledge_base_permissions");

            migrationBuilder.DropTable(
                name: "knowledge_file_permissions");

            migrationBuilder.DropTable(
                name: "knowledge_files");

            migrationBuilder.DropTable(
                name: "knowledge_bases");
        }
    }
}

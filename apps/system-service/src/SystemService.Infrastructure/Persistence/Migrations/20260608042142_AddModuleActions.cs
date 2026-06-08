using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SystemService.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddModuleActions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "module_actions",
                columns: table => new
                {
                    module_id = table.Column<Guid>(type: "uuid", nullable: false),
                    action_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_module_actions", x => new { x.module_id, x.action_id });
                    table.ForeignKey(
                        name: "fk_module_actions_modules_module_id",
                        column: x => x.module_id,
                        principalTable: "modules",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_module_actions_permission_actions_action_id",
                        column: x => x.action_id,
                        principalTable: "permission_actions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_module_actions_action_id",
                table: "module_actions",
                column: "action_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "module_actions");
        }
    }
}

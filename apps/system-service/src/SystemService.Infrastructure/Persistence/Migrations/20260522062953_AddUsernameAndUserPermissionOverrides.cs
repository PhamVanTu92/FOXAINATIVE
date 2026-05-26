using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SystemService.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUsernameAndUserPermissionOverrides : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "username",
                table: "users",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "user_permission_overrides",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    module_id = table.Column<Guid>(type: "uuid", nullable: false),
                    action_id = table.Column<Guid>(type: "uuid", nullable: false),
                    effect = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    granted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    granted_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_user_permission_overrides", x => new { x.user_id, x.module_id, x.action_id });
                    table.ForeignKey(
                        name: "fk_user_permission_overrides_modules_module_id",
                        column: x => x.module_id,
                        principalTable: "modules",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_user_permission_overrides_permission_actions_action_id",
                        column: x => x.action_id,
                        principalTable: "permission_actions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_user_permission_overrides_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_users_username",
                table: "users",
                column: "username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_user_permission_overrides_action_id",
                table: "user_permission_overrides",
                column: "action_id");

            migrationBuilder.CreateIndex(
                name: "ix_user_permission_overrides_module_id",
                table: "user_permission_overrides",
                column: "module_id");

            migrationBuilder.CreateIndex(
                name: "ix_user_permission_overrides_user_id",
                table: "user_permission_overrides",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_permission_overrides");

            migrationBuilder.DropIndex(
                name: "ix_users_username",
                table: "users");

            migrationBuilder.DropColumn(
                name: "username",
                table: "users");
        }
    }
}

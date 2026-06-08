using Microsoft.EntityFrameworkCore;
using SystemService.Domain.Entities;

namespace SystemService.Infrastructure.Persistence;

public class SystemDbContext(DbContextOptions<SystemDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<ModuleGroup> ModuleGroups => Set<ModuleGroup>();
    public DbSet<Module> Modules => Set<Module>();
    public DbSet<ModuleAction> ModuleActions => Set<ModuleAction>();
    public DbSet<PermissionAction> PermissionActions => Set<PermissionAction>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<UserPermissionOverride> UserPermissionOverrides => Set<UserPermissionOverride>();
    public DbSet<OrganizationNode> OrganizationNodes => Set<OrganizationNode>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SystemDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}

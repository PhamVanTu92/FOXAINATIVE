using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SystemService.Application.Abstractions.Security;
using SystemService.Domain.Entities;
using SystemService.Domain.Enums;

namespace SystemService.Infrastructure.Persistence.Seeding;

public static class DataSeeder
{
    public const string DefaultAdminEmail = "admin@foxai.local";
    public const string DefaultAdminPassword = "Admin@12345";

    public static async Task SeedAsync(IServiceProvider services, CancellationToken ct = default)
    {
        var scope = services.CreateScope();
        var sp = scope.ServiceProvider;
        var db = sp.GetRequiredService<SystemDbContext>();
        var hasher = sp.GetRequiredService<IPasswordHasher>();
        var logger = sp.GetRequiredService<ILogger<SystemDbContext>>();

        await SeedPermissionsAsync(db, ct);
        await SeedRolesAsync(db, ct);
        await SeedAdminUserAsync(db, hasher, ct);

        var saved = await db.SaveChangesAsync(ct);
        if (saved > 0)
        {
            logger.LogInformation("Seed completed: {Count} change(s) applied", saved);
        }
    }

    private static async Task SeedPermissionsAsync(SystemDbContext db, CancellationToken ct)
    {
        var existingCodes = await db.Permissions
            .Select(p => p.Code)
            .ToListAsync(ct);
        var existing = existingCodes.ToHashSet(StringComparer.Ordinal);

        foreach (var seed in PermissionSeedData.All)
        {
            if (!existing.Contains(seed.Code))
            {
                db.Permissions.Add(new Permission
                {
                    Id = Guid.NewGuid(),
                    Code = seed.Code,
                    Name = seed.Name,
                    Module = seed.Module,
                    Action = seed.Action,
                    Resource = seed.Resource,
                });
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedRolesAsync(SystemDbContext db, CancellationToken ct)
    {
        var allPermissions = await db.Permissions.ToDictionaryAsync(p => p.Code, ct);

        foreach (var seed in RoleSeedData.All)
        {
            var role = await db.Roles
                .Include(r => r.RolePermissions)
                .FirstOrDefaultAsync(r => r.Code == seed.Code, ct);

            if (role is null)
            {
                role = new Role
                {
                    Id = Guid.NewGuid(),
                    Code = seed.Code,
                    Name = seed.Name,
                    Description = seed.Description,
                    IsSystem = seed.IsSystem,
                };
                db.Roles.Add(role);
            }

            var desired = RoleSeedData.RolePermissions.GetValueOrDefault(seed.Code, Array.Empty<string>());
            var current = role.RolePermissions.Select(rp => rp.PermissionId).ToHashSet();

            foreach (var code in desired)
            {
                if (!allPermissions.TryGetValue(code, out var permission)) continue;
                if (current.Contains(permission.Id)) continue;

                role.RolePermissions.Add(new RolePermission
                {
                    Role = role,
                    Permission = permission,
                });
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedAdminUserAsync(SystemDbContext db, IPasswordHasher hasher, CancellationToken ct)
    {
        var existing = await db.Users.FirstOrDefaultAsync(u => u.Email == DefaultAdminEmail, ct);
        if (existing is not null)
        {
            return;
        }

        var superAdmin = await db.Roles.FirstOrDefaultAsync(r => r.Code == RoleSeedData.SuperAdminCode, ct);
        if (superAdmin is null)
        {
            return;
        }

        var admin = new User
        {
            Id = Guid.NewGuid(),
            Email = DefaultAdminEmail,
            PasswordHash = hasher.Hash(DefaultAdminPassword),
            FullName = "System Administrator",
            Status = UserStatus.Active,
        };
        admin.UserRoles.Add(new UserRole
        {
            User = admin,
            Role = superAdmin,
            AssignedAt = DateTime.UtcNow,
        });

        db.Users.Add(admin);
        await db.SaveChangesAsync(ct);
    }
}

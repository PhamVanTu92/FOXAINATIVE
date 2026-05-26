# FOXAI System Service - gRPC smoke test (PowerShell + grpcurl)
#
# Usage:
#   .\grpcurl-smoke-test.ps1                 # default localhost:51051
#   .\grpcurl-smoke-test.ps1 -GrpcUrl localhost:51051
#
# Requires:
#   - grpcurl on PATH (choco install grpcurl OR scoop install grpcurl)
#   - System Service running with gRPC reflection enabled (Development mode)
#
# Tests all 5 services end-to-end. Reports pass/fail per step.

param(
    [string]$GrpcUrl = "localhost:51051",
    [string]$HealthUrl = "http://localhost:3002/health",
    [string]$AdminEmail = "admin@foxai.local",
    [string]$AdminPassword = "Admin@12345"
)

$ErrorActionPreference = 'Stop'
$script:Failed = 0
$script:Passed = 0

function Step($name) { Write-Host "`n==> $name" -ForegroundColor Cyan }
function Pass($msg)  { Write-Host "    [OK] $msg" -ForegroundColor Green; $script:Passed++ }
function Fail($msg)  { Write-Host "    [FAIL] $msg" -ForegroundColor Red;  $script:Failed++ }
function Invoke-Grpc($Method, $Body, [string]$Token = $null) {
    $args = @('-plaintext')
    if ($Token) { $args += @('-H', "authorization: Bearer $Token") }
    if ($Body)  { $args += @('-d', $Body) }
    $args += @($GrpcUrl, $Method)

    $output = & grpcurl @args 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "grpcurl failed: $output"
    }
    return ($output -join "`n") | ConvertFrom-Json
}

# ── 0. Prerequisites ──────────────────────────────────────────────────────────
Step "Prerequisites"
if (-not (Get-Command grpcurl -ErrorAction SilentlyContinue)) {
    Fail "grpcurl not found. Install via: choco install grpcurl"
    exit 1
}
Pass "grpcurl found"

# ── 1. Health check ───────────────────────────────────────────────────────────
Step "Health check (REST /health)"
try {
    $health = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 5
    if ($health -eq 'Healthy') { Pass "Health = Healthy" } else { Fail "Health = $health" }
} catch {
    Fail "Health endpoint unreachable: $($_.Exception.Message)"
    exit 1
}

# ── 2. List services via reflection ───────────────────────────────────────────
Step "List gRPC services via reflection"
try {
    $services = & grpcurl -plaintext $GrpcUrl list 2>&1
    if ($LASTEXITCODE -ne 0) { throw $services }
    $services = $services -split "`n"
    $required = @(
        'foxai.system.AuthService',
        'foxai.system.UsersService',
        'foxai.system.RolesService',
        'foxai.system.PermissionsService',
        'foxai.system.OrganizationsService'
    )
    $missing = $required | Where-Object { $services -notcontains $_ }
    if ($missing.Count -eq 0) {
        Pass "All 5 services exposed"
    } else {
        Fail "Missing: $($missing -join ', ')"
    }
} catch {
    Fail "Reflection failed (is Development mode? `MapGrpcReflectionService` only enabled when IsDevelopment): $_"
    exit 1
}

# ── 3. Auth: Login ────────────────────────────────────────────────────────────
Step "AuthService.Login (admin)"
try {
    $body = "{`"email`":`"$AdminEmail`",`"password`":`"$AdminPassword`"}"
    $login = Invoke-Grpc 'foxai.system.AuthService/Login' $body
    if ($login.accessToken -and $login.refreshToken -and $login.user.email -eq $AdminEmail) {
        Pass "JWT issued (roles: $($login.user.roles -join ','))"
        $accessToken = $login.accessToken
        $refreshToken = $login.refreshToken
        $adminUserId = $login.user.id
    } else {
        Fail "Login response missing fields"
        exit 1
    }
} catch { Fail "Login failed: $_"; exit 1 }

# ── 4. Auth: ValidateToken ────────────────────────────────────────────────────
Step "AuthService.ValidateToken (just-issued token)"
try {
    $validate = Invoke-Grpc 'foxai.system.AuthService/ValidateToken' "{`"accessToken`":`"$accessToken`"}"
    if ($validate.valid) {
        Pass "Token valid; user = $($validate.user.email)"
    } else {
        Fail "Token validation returned invalid: $($validate.error)"
    }
} catch { Fail $_ }

# ── 5. Permissions: list ──────────────────────────────────────────────────────
Step "PermissionsService.ListPermissions"
try {
    $perms = Invoke-Grpc 'foxai.system.PermissionsService/ListPermissions' '{}' $accessToken
    if ($perms.items.Count -ge 24) {
        Pass "Got $($perms.items.Count) permissions (>= 24 seeded)"
    } else {
        Fail "Only $($perms.items.Count) permissions returned"
    }
} catch { Fail $_ }

# ── 6. Roles: create custom role ──────────────────────────────────────────────
$testRoleCode = "SMOKE_TEST_$(Get-Random)"
Step "RolesService.CreateRole ($testRoleCode)"
try {
    $body = @{
        code = $testRoleCode
        name = "Smoke Test Role"
        permissionCodes = @('USER_READ', 'ROLE_READ')
    } | ConvertTo-Json -Compress
    $role = Invoke-Grpc 'foxai.system.RolesService/CreateRole' $body $accessToken
    if ($role.code -eq $testRoleCode -and -not $role.isSystem) {
        Pass "Role created: $($role.id)"
        $testRoleId = $role.id
    } else { Fail "Role created but data mismatch"; }
} catch { Fail $_ }

# ── 7. Organizations: create root + child ─────────────────────────────────────
$rootCode = "smoke-root-$(Get-Random)"
$childCode = "smoke-child-$(Get-Random)"
Step "OrganizationsService.CreateNode (root)"
try {
    $body = "{`"code`":`"$rootCode`",`"name`":`"Smoke Root`"}"
    $root = Invoke-Grpc 'foxai.system.OrganizationsService/CreateNode' $body $accessToken
    if ($root.level -eq 0 -and $root.path -eq "/$rootCode") {
        Pass "Root created: level=0, path=$($root.path)"
        $rootId = $root.id
    } else { Fail "Unexpected root state" }
} catch { Fail $_ }

Step "OrganizationsService.CreateNode (child)"
try {
    $body = "{`"code`":`"$childCode`",`"name`":`"Smoke Child`",`"parentId`":`"$rootId`"}"
    $child = Invoke-Grpc 'foxai.system.OrganizationsService/CreateNode' $body $accessToken
    if ($child.level -eq 1 -and $child.path -eq "/$rootCode/$childCode") {
        Pass "Child created: level=1, path=$($child.path)"
        $childId = $child.id
    } else { Fail "Unexpected child state" }
} catch { Fail $_ }

# ── 8. Users: create user assigned to child org with role ─────────────────────
$testEmail = "smoke-$(Get-Random)@foxai.local"
$testPassword = "Smoke@12345"
Step "UsersService.CreateUser ($testEmail)"
try {
    $body = @{
        email = $testEmail
        password = $testPassword
        fullName = "Smoke Test User"
        organizationId = $childId
        roleCodes = @($testRoleCode)
    } | ConvertTo-Json -Compress
    $user = Invoke-Grpc 'foxai.system.UsersService/CreateUser' $body $accessToken
    if ($user.email -eq $testEmail -and $user.roles -contains $testRoleCode) {
        Pass "User created: $($user.id)"
        $testUserId = $user.id
    } else { Fail "Created user data mismatch" }
} catch { Fail $_ }

# ── 9. Login as new user ──────────────────────────────────────────────────────
Step "AuthService.Login (as new user)"
try {
    $body = "{`"email`":`"$testEmail`",`"password`":`"$testPassword`"}"
    $newLogin = Invoke-Grpc 'foxai.system.AuthService/Login' $body
    if ($newLogin.accessToken -and $newLogin.user.roles -contains $testRoleCode) {
        Pass "New user can login; roles: $($newLogin.user.roles -join ',')"
        $newUserAccessToken = $newLogin.accessToken
        $newUserRefreshToken = $newLogin.refreshToken
    } else { Fail "New user login failed" }
} catch { Fail $_ }

# ── 10. Users: ListUsers by org (includeSubOrgs) ──────────────────────────────
Step "OrganizationsService.ListUsersByOrg (root + includeSubOrgs)"
try {
    $body = @{
        organizationId = $rootId
        pagination = @{ page = 1; pageSize = 50 }
        includeSubOrgs = $true
    } | ConvertTo-Json -Compress
    $list = Invoke-Grpc 'foxai.system.OrganizationsService/ListUsersByOrg' $body $accessToken
    if ($list.page.totalItems -ge 1) {
        Pass "Found $($list.page.totalItems) users in subtree (expected new user is there)"
    } else { Fail "No users found" }
} catch { Fail $_ }

# ── 11. Auth: RefreshToken (rotate) ───────────────────────────────────────────
Step "AuthService.RefreshToken (rotate)"
try {
    $body = "{`"refreshToken`":`"$newUserRefreshToken`"}"
    $rotated = Invoke-Grpc 'foxai.system.AuthService/RefreshToken' $body
    if ($rotated.accessToken -and $rotated.refreshToken -and $rotated.refreshToken -ne $newUserRefreshToken) {
        Pass "Refresh token rotated"
        $rotatedRefresh = $rotated.refreshToken
    } else { Fail "Refresh did not rotate" }
} catch { Fail $_ }

Step "AuthService.RefreshToken (reuse OLD token should fail)"
try {
    $body = "{`"refreshToken`":`"$newUserRefreshToken`"}"
    Invoke-Grpc 'foxai.system.AuthService/RefreshToken' $body | Out-Null
    Fail "Old token was accepted (security bug!)"
} catch {
    if ($_.Exception.Message -match 'Unauthenticated|UNAUTHENTICATED|revoke') {
        Pass "Old token correctly rejected"
    } else {
        Fail "Unexpected error: $_"
    }
}

# ── 12. Auth: Logout ──────────────────────────────────────────────────────────
Step "AuthService.Logout"
try {
    Invoke-Grpc 'foxai.system.AuthService/Logout' "{`"refreshToken`":`"$rotatedRefresh`"}" | Out-Null
    Pass "Logout success"
} catch { Fail $_ }

# ── 13. Cleanup: delete test entities (DeleteUser → DeleteNode → DeleteRole) ──
Step "Cleanup: DeleteUser (soft → INACTIVE)"
try {
    Invoke-Grpc 'foxai.system.UsersService/DeleteUser' "{`"id`":`"$testUserId`"}" $accessToken | Out-Null
    Pass "User soft-deleted"
} catch { Fail $_ }

Step "Cleanup: DeleteNode (child)"
try {
    Invoke-Grpc 'foxai.system.OrganizationsService/DeleteNode' "{`"id`":`"$childId`"}" $accessToken | Out-Null
    Pass "Child org deleted"
} catch { Fail $_ }

Step "Cleanup: DeleteNode (root)"
try {
    Invoke-Grpc 'foxai.system.OrganizationsService/DeleteNode' "{`"id`":`"$rootId`"}" $accessToken | Out-Null
    Pass "Root org deleted"
} catch { Fail $_ }

Step "Cleanup: DeleteRole ($testRoleCode)"
try {
    Invoke-Grpc 'foxai.system.RolesService/DeleteRole' "{`"id`":`"$testRoleId`"}" $accessToken | Out-Null
    Pass "Test role deleted"
} catch { Fail $_ }

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  SMOKE TEST SUMMARY" -ForegroundColor Cyan
Write-Host "========================================"
Write-Host "  Passed: $script:Passed" -ForegroundColor Green
Write-Host "  Failed: $script:Failed" -ForegroundColor $(if ($script:Failed -gt 0) { 'Red' } else { 'DarkGray' })
Write-Host "========================================`n"

if ($script:Failed -gt 0) { exit 1 } else { exit 0 }

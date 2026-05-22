import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  // Username (lowercase) hoặc email - server tự detect.
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  login!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password!: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class ValidateTokenDto {
  @IsString()
  @IsNotEmpty()
  accessToken!: string;
}

export class LogoutDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { SYSTEM_PACKAGE } from '../../grpc/system-grpc.module';
import { callGrpc } from '../../common/grpc/grpc-error-mapper';
import {
  AuthGrpcService,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  RefreshTokenRequest,
  ValidateTokenRequest,
  ValidateTokenResponse,
} from '../grpc-interfaces';

@Injectable()
export class AuthService implements OnModuleInit {
  private auth!: AuthGrpcService;

  constructor(@Inject(SYSTEM_PACKAGE) private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.auth = this.client.getService<AuthGrpcService>('AuthService');
  }

  login(req: LoginRequest): Promise<LoginResponse> {
    return callGrpc(this.auth.login(req));
  }

  refresh(req: RefreshTokenRequest): Promise<LoginResponse> {
    return callGrpc(this.auth.refreshToken(req));
  }

  validate(req: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    return callGrpc(this.auth.validateToken(req));
  }

  logout(req: LogoutRequest): Promise<void> {
    return callGrpc(this.auth.logout(req)).then(() => undefined);
  }
}

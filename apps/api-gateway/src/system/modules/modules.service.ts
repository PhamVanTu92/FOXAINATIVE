import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { SYSTEM_PACKAGE } from '../../grpc/system-grpc.module';
import { callGrpc } from '../../common/grpc/grpc-error-mapper';
import {
  CreateModuleRequest,
  DeleteModuleRequest,
  GetModuleRequest,
  ListModulesRequest,
  ListModulesResponse,
  ModuleDto,
  ModulesGrpcService,
  UpdateModuleRequest,
} from '../grpc-interfaces';

@Injectable()
export class ModulesService implements OnModuleInit {
  private svc!: ModulesGrpcService;

  constructor(@Inject(SYSTEM_PACKAGE) private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.svc = this.client.getService<ModulesGrpcService>('ModulesService');
  }

  list(req: ListModulesRequest, md?: Metadata): Promise<ListModulesResponse> {
    return callGrpc(this.svc.listModules(req, md));
  }
  get(req: GetModuleRequest, md?: Metadata): Promise<ModuleDto> {
    return callGrpc(this.svc.getModule(req, md));
  }
  create(req: CreateModuleRequest, md?: Metadata): Promise<ModuleDto> {
    return callGrpc(this.svc.createModule(req, md));
  }
  update(req: UpdateModuleRequest, md?: Metadata): Promise<ModuleDto> {
    return callGrpc(this.svc.updateModule(req, md));
  }
  remove(req: DeleteModuleRequest, md?: Metadata): Promise<void> {
    return callGrpc(this.svc.deleteModule(req, md)).then(() => undefined);
  }
}

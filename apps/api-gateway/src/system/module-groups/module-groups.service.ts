import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { SYSTEM_PACKAGE } from '../../grpc/system-grpc.module';
import { callGrpc } from '../../common/grpc/grpc-error-mapper';
import {
  CreateModuleGroupRequest,
  DeleteModuleGroupRequest,
  GetModuleGroupRequest,
  ListModuleGroupsRequest,
  ListModuleGroupsResponse,
  ModuleGroupDto,
  ModuleGroupsGrpcService,
  UpdateModuleGroupRequest,
} from '../grpc-interfaces';

@Injectable()
export class ModuleGroupsService implements OnModuleInit {
  private svc!: ModuleGroupsGrpcService;

  constructor(@Inject(SYSTEM_PACKAGE) private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.svc = this.client.getService<ModuleGroupsGrpcService>('ModuleGroupsService');
  }

  list(req: ListModuleGroupsRequest, md?: Metadata): Promise<ListModuleGroupsResponse> {
    return callGrpc(this.svc.listModuleGroups(req, md));
  }
  get(req: GetModuleGroupRequest, md?: Metadata): Promise<ModuleGroupDto> {
    return callGrpc(this.svc.getModuleGroup(req, md));
  }
  create(req: CreateModuleGroupRequest, md?: Metadata): Promise<ModuleGroupDto> {
    return callGrpc(this.svc.createModuleGroup(req, md));
  }
  update(req: UpdateModuleGroupRequest, md?: Metadata): Promise<ModuleGroupDto> {
    return callGrpc(this.svc.updateModuleGroup(req, md));
  }
  remove(req: DeleteModuleGroupRequest, md?: Metadata): Promise<void> {
    return callGrpc(this.svc.deleteModuleGroup(req, md)).then(() => undefined);
  }
}

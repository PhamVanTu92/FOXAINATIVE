import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { status as GrpcStatus } from '@grpc/grpc-js';

const logger = new Logger('GrpcError');

// gRPC StatusCode → HTTP Status
const GRPC_TO_HTTP: Record<number, HttpStatus> = {
  [GrpcStatus.OK]: HttpStatus.OK,
  [GrpcStatus.CANCELLED]: 499 as HttpStatus,
  [GrpcStatus.UNKNOWN]: HttpStatus.INTERNAL_SERVER_ERROR,
  [GrpcStatus.INVALID_ARGUMENT]: HttpStatus.BAD_REQUEST,
  [GrpcStatus.DEADLINE_EXCEEDED]: HttpStatus.GATEWAY_TIMEOUT,
  [GrpcStatus.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [GrpcStatus.ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [GrpcStatus.PERMISSION_DENIED]: HttpStatus.FORBIDDEN,
  [GrpcStatus.RESOURCE_EXHAUSTED]: HttpStatus.TOO_MANY_REQUESTS,
  [GrpcStatus.FAILED_PRECONDITION]: HttpStatus.UNPROCESSABLE_ENTITY,
  [GrpcStatus.ABORTED]: HttpStatus.CONFLICT,
  [GrpcStatus.OUT_OF_RANGE]: HttpStatus.BAD_REQUEST,
  [GrpcStatus.UNIMPLEMENTED]: HttpStatus.NOT_IMPLEMENTED,
  [GrpcStatus.INTERNAL]: HttpStatus.INTERNAL_SERVER_ERROR,
  [GrpcStatus.UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  [GrpcStatus.DATA_LOSS]: HttpStatus.INTERNAL_SERVER_ERROR,
  [GrpcStatus.UNAUTHENTICATED]: HttpStatus.UNAUTHORIZED,
};

const STATUS_NAME: Record<number, string> = {
  [GrpcStatus.INVALID_ARGUMENT]: 'INVALID_ARGUMENT',
  [GrpcStatus.NOT_FOUND]: 'NOT_FOUND',
  [GrpcStatus.ALREADY_EXISTS]: 'ALREADY_EXISTS',
  [GrpcStatus.PERMISSION_DENIED]: 'PERMISSION_DENIED',
  [GrpcStatus.FAILED_PRECONDITION]: 'FAILED_PRECONDITION',
  [GrpcStatus.UNAUTHENTICATED]: 'UNAUTHENTICATED',
  [GrpcStatus.UNAVAILABLE]: 'UNAVAILABLE',
  [GrpcStatus.INTERNAL]: 'INTERNAL',
  [GrpcStatus.UNIMPLEMENTED]: 'UNIMPLEMENTED',
};

export function mapGrpcError(err: any): HttpException {
  const code = typeof err?.code === 'number' ? err.code : GrpcStatus.UNKNOWN;
  const httpStatus = GRPC_TO_HTTP[code] ?? HttpStatus.INTERNAL_SERVER_ERROR;

  const message =
    (typeof err?.details === 'string' && err.details) ||
    err?.message ||
    'Internal error';

  if (code >= GrpcStatus.INTERNAL && code !== GrpcStatus.UNAUTHENTICATED) {
    logger.error(`gRPC error ${code}: ${message}`, err?.stack);
  }

  return new HttpException(
    {
      statusCode: httpStatus,
      grpcCode: code,
      grpcStatus: STATUS_NAME[code] ?? 'UNKNOWN',
      message,
    },
    httpStatus,
  );
}

export async function callGrpc<T>(observable: { toPromise?: () => Promise<T> } | any): Promise<T> {
  try {
    if (typeof observable?.toPromise === 'function') {
      return (await observable.toPromise()) as T;
    }
    // rxjs Observable - dùng firstValueFrom thay vì toPromise deprecated
    const { firstValueFrom } = await import('rxjs');
    return await firstValueFrom(observable);
  } catch (err) {
    throw mapGrpcError(err);
  }
}

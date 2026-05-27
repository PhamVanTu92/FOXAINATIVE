from __future__ import annotations

from enum import Enum
from typing import Any
from typing import Optional

from fastapi import status
from fastapi.responses import JSONResponse
from joint.base import BaseModel
# from structlog.stdlib import BoundLogger


class ResponseMessage(str, Enum):
    INTERNAL_SERVER_ERROR = 'Server might meet some errors. Please try again later !!!'
    SUCCESS = 'Process successfully !!!'
    NOT_FOUND = 'Resource not found !!!'
    BAD_REQUEST = 'Invalid request !!!'
    UNPROCESSABLE_ENTITY = 'Input is not allowed !!!'
    UNAUTHORIZED = 'Not authenticated'
    FORBIDDEN = 'Access denied'


class ExceptionHandler(BaseModel):
    logger: Any

    def _create_response(
        self,
        message: str,
        data: Optional[dict] = None,
        status_code: int = status.HTTP_200_OK,
        detail: Optional[str] = None,
    ) -> JSONResponse:
        """Create a response object

        Args:
            message (str): main message to be returned
            data (Optional[dict], optional): data to be returned. Defaults to None.
            status_code (int, optional): status code of the response. Defaults to status.HTTP_200_OK.
            detail (Optional[str], optional): additional detail message. Defaults to None.

        Returns:
            Response: response object
        """
        response_data = {'message': message}
        if detail:
            response_data['detail'] = detail
        if data:
            response_data.update(data)

        return JSONResponse(content=response_data, status_code=status_code)

    def handle_exception(self, e: str, extra: dict) -> JSONResponse:
        """Handle exception

        Args:
            e (str): exception message
            extra (dict): extra information

        Returns:
            Response: response object
        """
        self.logger.exception(e, extra=extra)

        return self._create_response(
            ResponseMessage.INTERNAL_SERVER_ERROR.value,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    def handle_not_found_error(self, message: str, extra: dict) -> JSONResponse:
        """Handle not found error

        Args:
            message (str): specific message to be returned to user
            extra (dict): extra information for logging

        Returns:
            Response: response object
        """
        self.logger.error(
            message,
            extra=extra,
        )

        return self._create_response(
            ResponseMessage.NOT_FOUND.value,
            status_code=status.HTTP_404_NOT_FOUND,
            detail=message,
        )

    def handle_success(self, output: dict) -> JSONResponse:
        """Handle success

        Args:
            output (dict): output

        Returns:
            Response: response object
        """
        data = {'info': output}

        return self._create_response(
            ResponseMessage.SUCCESS.value,
            data=data,
            status_code=status.HTTP_200_OK,
        )

    @property
    def handle_success_status(self) -> JSONResponse:
        """Handle success

        Args:
            output (dict): output

        Returns:
            Response: response object
        """

        return self._create_response(
            ResponseMessage.SUCCESS.value,
            status_code=status.HTTP_200_OK,
        )

    def handle_bad_request(self, message: str, extra: dict) -> JSONResponse:
        """Handle bad request

        Args:
            message: Specific message to be returned to user
            extra: Extra logging context
        """
        self.logger.error(
            message,
            extra=extra,
        )

        return self._create_response(
            ResponseMessage.BAD_REQUEST.value,
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
        )

    def handle_unprocessable_entity(self, message: str, extra: dict) -> JSONResponse:
        """Handle unprocessable entity

        Args:
            message: Specific message to be returned to user
            extra: Extra logging context
        """
        self.logger.error(
            message,
            extra=extra,
        )

        return self._create_response(
            ResponseMessage.UNPROCESSABLE_ENTITY.value,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=message,
        )

    def handle_unauthorized(self, message: str | None = None, extra: dict | None = None) -> JSONResponse:
        """Handle unauthorized access

        Args:
            message: Specific message to be returned to user
            extra: Extra logging context
        """
        if extra:
            self.logger.error(
                message or ResponseMessage.UNAUTHORIZED.value,
                extra=extra,
            )

        return self._create_response(
            ResponseMessage.UNAUTHORIZED.value,
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=message,
        )

    def handle_forbidden(self, message: str | None = None, extra: dict | None = None) -> JSONResponse:
        """Handle forbidden access

        Args:
            message: Specific message to be returned to user
            extra: Extra logging context
        """
        if extra:
            self.logger.error(
                message or ResponseMessage.FORBIDDEN.value,
                extra=extra,
            )

        return self._create_response(
            ResponseMessage.FORBIDDEN.value,
            status_code=status.HTTP_403_FORBIDDEN,
            detail=message,
        )

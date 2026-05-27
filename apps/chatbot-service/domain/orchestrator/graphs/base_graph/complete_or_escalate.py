from __future__ import annotations

from joint.base import BaseModel


class CompleteOrEscalate(BaseModel):
    """Return control to main assistant when task is completed or outside domain expertise."""

    cancel: bool = True
    reason: str

    # class Config:
    #     json_schema_extra = {
    #         'example': {
    #             'cancel': True,
    #             'reason': 'Completed providing loan product information. Returning to main assistant.',
    #         },
    #         'example 2': {
    #             'cancel': True,
    #             'reason': 'Customer asks about branch locations, outside document comparison scope. Transferring to main assistant.',
    #         },
    #         'example 3': {
    #             'cancel': True,
    #             'reason': 'Successfully retrieved deposit interest rate details. No further assistance needed.',
    #         },
    #         'example 4': {
    #             'cancel': True,
    #             'reason': 'Customer switched to asking about international payment services, outside current scope.',
    #         },
    #         'example 5': {
    #             'cancel': True,
    #             'reason': 'Completed document comparison analysis. Returning to main assistant for further help.',
    #         },
    #         'example 6': {
    #             'cancel': True,
    #             'reason': 'Customer wants to compare loan products, transferring to comparison specialist.',
    #         },
    #         'example 7': {
    #             'cancel': True,
    #             'reason': 'Provided trade finance policy details. Task complete.',
    #         },
    #         'example 8': {
    #             'cancel': True,
    #             'reason': 'Customer asks about account opening procedures, need to route to information retrieval.',
    #         },
    #     }

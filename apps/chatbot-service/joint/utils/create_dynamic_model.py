from __future__ import annotations

from typing import Any
from typing import Dict
from typing import Optional
from typing import Type

from pydantic import BaseModel
from pydantic import create_model
from pydantic import Field


def create_dynamic_model(node_name_dev: str, config_json: Dict[str, Any]) -> Type[BaseModel]:
    """
    Create dynamic BaseModel from node configuration
    """
    # Get body configuration from config_json - try both possible structures
    body_config = config_json.get('body', {})
    if not body_config:
        # Fallback to nested structure if direct body doesn't exist
        body_config = config_json.get('config', {}).get('body', {})

    if not body_config:
        raise ValueError(
            f"No body configuration found for node: {node_name_dev}. Available keys: {list(config_json.keys())}",
        )

    field_definitions = {}
    type_mapping = {'string': str, 'int': int, 'float': float, 'bool': bool}

    for field_name, field_cfg in body_config.items():
        python_type = type_mapping.get(field_cfg.get('type', 'string'), str)
        description = field_cfg.get('description', f"Field {field_name}")

        field_info: Any
        if field_cfg.get('required', False):
            field_info = (python_type, Field(..., description=description))
        else:
            field_info = (
                Optional[python_type], Field(
                    None, description=description,
                ),
            )

        field_definitions[field_name] = field_info

    # === IMPORTANT CHANGE: CREATE DICTIONARY INSTEAD OF CLASS ===
    # Remove DynamicConfig class and create a dictionary directly
    model_config_dict = {
        'json_schema_extra': {
            'description': f"Dynamically generated model for {node_name_dev}",
            # 'example': {
            #     field_name: 'example_value' if field_cfg.get('type') == 'string' else
            #     0 if field_cfg.get('type') in ['int', 'float'] else
            #     True if field_cfg.get('type') == 'bool' else None
            #     for field_name, field_cfg in body_config.items()
            # },
        },
    }

    # Create dynamic model class
    model_class = create_model(
        node_name_dev.title().replace('_', ''),
        **field_definitions,
        # Pass dictionary config to __config__
        __config__=model_config_dict,
        __doc__=f"Dynamically generated model for {node_name_dev}",
    )

    return model_class

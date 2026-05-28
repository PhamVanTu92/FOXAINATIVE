"""
Configuration API Client

This module provides a client for calling workflow configuration APIs.
"""
from __future__ import annotations

import logging
from typing import Any
from typing import Dict
from typing import Optional

import requests

logger = logging.getLogger(__name__)


class ConfigurationAPIClient:
    """
    Client for calling workflow configuration API.

    This client handles API requests to retrieve node configurations
    for workflows with proper error handling and logging.
    """

    def __init__(self, base_url: str = 'https://api.internal', timeout: int = 30):
        """
        Initialize the API client.

        Args:
            base_url: Base URL for the API
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.session = requests.Session()

        # Set default headers
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        })

    def get_node_configuration(
        self,
        workflow_name: str,
        node_name: str,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Get node configuration from API.

        Args:
            workflow_name: Name of the workflow
            node_name: Name of the node
            headers: Optional additional headers

        Returns:
            Dictionary containing node configuration data

        Raises:
            requests.exceptions.RequestException: If API request fails
            ValueError: If response format is invalid
        """
        endpoint = f"{self.base_url}/workflow-config/get-node-config"

        payload = {
            'workflow_name': workflow_name,
            'node_name': node_name,
        }

        logger.info(f"Calling API: {endpoint}")

        try:
            # Merge additional headers if provided
            request_headers = {}
            if headers:
                request_headers.update(headers)

            response = self.session.post(
                endpoint,
                json=payload,
                headers=request_headers,
                timeout=self.timeout,
            )
            response.raise_for_status()

            api_response = response.json()
            logger.info('API call successful')

            # Validate response structure
            if not isinstance(api_response, dict):
                raise ValueError(
                    'Invalid response format: expected dictionary',
                )

            if api_response.get('status') == 'success':
                data = api_response.get('data', {})
                if not data:
                    raise ValueError('No data in successful response')
                return data
            else:
                error_msg = api_response.get('message', 'Unknown API error')
                logger.error(f"API error: {error_msg}")
                return {
                    'name_node_dev': node_name,
                    'config_json': {'error': error_msg},
                }

        except requests.exceptions.Timeout:
            error_msg = f"Request timeout after {self.timeout} seconds"
            logger.error(error_msg)
            return {
                'name_node_dev': node_name,
                'config_json': {'error': error_msg},
            }
        except requests.exceptions.ConnectionError:
            error_msg = 'Connection error: Unable to reach API'
            logger.error(error_msg)
            return {
                'name_node_dev': node_name,
                'config_json': {'error': error_msg},
            }
        except requests.exceptions.HTTPError as e:
            error_msg = f"HTTP error {e.response.status_code}: {e.response.text}"
            logger.error(error_msg)
            return {
                'name_node_dev': node_name,
                'config_json': {'error': error_msg},
            }
        except requests.exceptions.RequestException as e:
            error_msg = f"Request failed: {str(e)}"
            logger.error(error_msg)
            return {
                'name_node_dev': node_name,
                'config_json': {'error': error_msg},
            }
        except ValueError as e:
            error_msg = f"Response validation error: {str(e)}"
            logger.error(error_msg)
            return {
                'name_node_dev': node_name,
                'config_json': {'error': error_msg},
            }
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(error_msg)
            return {
                'name_node_dev': node_name,
                'config_json': {'error': error_msg},
            }

    def close(self):
        """Close the session."""
        self.session.close()

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()


def get_node_configuration(
    workflow_name: str,
    node_name: str,
    base_url: str = 'https://api.internal',
    timeout: int = 30,
    headers: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Convenience function to get node configuration.

    Args:
        workflow_name: Name of the workflow
        node_name: Name of the node
        base_url: Base URL for the API
        timeout: Request timeout in seconds
        headers: Optional additional headers

    Returns:
        Dictionary containing node configuration data
    """
    with ConfigurationAPIClient(base_url, timeout) as client:
        return client.get_node_configuration(workflow_name, node_name, headers)

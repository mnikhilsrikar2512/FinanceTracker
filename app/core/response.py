from typing import Any, Optional
from datetime import datetime

class ApiResponse:
    """Standardized API response format"""
    
    @staticmethod
    def success(data: Any = None, meta: dict = None, message: str = None) -> dict:
        # Always include data and meta with defaults to ensure a stable contract
        response = {
            "success": True,
            "data": data if data is not None else {},
            "meta": meta if isinstance(meta, dict) else {},
        }
        if message:
            response["message"] = message
        return response
    
    @staticmethod
    def with_meta(data: Any, meta: dict) -> dict:
        response = {
            "success": True,
            "data": data,
            "meta": meta
        }
        return response
    
    @staticmethod
    def paginated(data: list, total: int, limit: int, offset: int, filters: dict = None) -> dict:
        return {
            "success": True,
            "data": data,
            "meta": {
                "total": total,
                "limit": limit,
                "offset": offset,
                "page": (offset // limit) + 1 if limit > 0 else 1,
                "total_pages": (total + limit - 1) // limit if limit > 0 else 1,
                "has_next": (offset + limit) < total,
                "has_prev": offset > 0,
                "filters": filters or {}
            }
        }
    
    @staticmethod
    def error(message: str, error_code: str = "ERR_INTERNAL", status_code: int = 500, details: Any = None) -> dict:
        response = {
            "success": False,
            "error": message,
            "error_code": error_code
        }
        if details:
            response["details"] = details
        return response


def success_response(data: Any = None, message: str = None):
    return ApiResponse.success(data=data, message=message)


def paginated_response(data: list, total: int, limit: int, offset: int, filters: dict = None):
    return ApiResponse.paginated(data, total, limit, offset, filters)


def error_response(message: str, error_code: str = "ERR_INTERNAL"):
    return ApiResponse.error(message, error_code)

import re
from html import escape

class InputSanitizer:
    """Sanitizes user input to prevent XSS and injection attacks"""
    
    @staticmethod
    def sanitize_string(value: str, max_length: int = 255) -> str:
        if not isinstance(value, str):
            return str(value)
        
        sanitized = escape(value.strip())
        
        if len(sanitized) > max_length:
            sanitized = sanitized[:max_length]
        
        return sanitized
    
    @staticmethod
    def sanitize_name(name: str) -> str:
        sanitized = InputSanitizer.sanitize_string(name, 100)
        
        allowed_pattern = re.compile(r'^[a-zA-Z0-9\s\-\.\']+$')
        if not allowed_pattern.match(sanitized):
            raise ValueError("Name contains invalid characters")
        
        return sanitized
    
    @staticmethod
    def sanitize_description(description: str) -> str:
        if not description:
            return description
        
        sanitized = InputSanitizer.sanitize_string(description, 1000)
        
        dangerous_patterns = [
            r'<script',
            r'javascript:',
            r'onerror=',
            r'onclick=',
            r'onload=',
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, sanitized, re.IGNORECASE):
                sanitized = re.sub(pattern, '', sanitized, flags=re.IGNORECASE)
        
        return sanitized
    
    @staticmethod
    def sanitize_search(search: str) -> str:
        sanitized = InputSanitizer.sanitize_string(search, 100)
        
        dangerous_chars = ['%', '_', '[', ']', '\\']
        for char in dangerous_chars:
            sanitized = sanitized.replace(char, f'\\{char}')
        
        return sanitized


sanitizer = InputSanitizer()

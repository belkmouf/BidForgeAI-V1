"""
BidForge AI - Logging Configuration
"""

import os
import logging
from logging.handlers import RotatingFileHandler


def setup_logger(name: str, log_level: str = None) -> logging.Logger:
    """
    Setup logger with console and file handlers.
    
    Args:
        name: Logger name
        log_level: Log level (DEBUG, INFO, WARNING, ERROR)
    
    Returns:
        Configured logger
    """
    # Get log level from environment or parameter
    level_str = log_level or os.getenv("LOG_LEVEL", "INFO")
    level = getattr(logging, level_str.upper(), logging.INFO)
    
    # Create logger
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Avoid duplicate handlers
    if logger.handlers:
        return logger
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(level)
    console_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)
    
    # File handler (optional)
    log_dir = os.getenv("LOG_DIR", "logs")
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    file_handler = RotatingFileHandler(
        f"{log_dir}/{name}.log",
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5
    )
    file_handler.setLevel(level)
    file_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)
    
    return logger

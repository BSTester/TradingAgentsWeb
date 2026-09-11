"""
Setup script for the TradingAgents package.

依赖声明与打包配置的单一事实源已迁移至 `pyproject.toml`
（[project].dependencies / [project.scripts] / [tool.setuptools]）。
本文件仅保留 setup.py 兼容性垫片，避免与 pyproject 的字段冲突。
"""

from setuptools import setup

setup(
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Financial and Trading Industry",
        "License :: OSI Approved :: Apache Software License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Topic :: Office/Business :: Financial :: Investment",
    ],
)

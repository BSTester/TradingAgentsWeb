#!/usr/bin/env python3
"""
Page Routes
页面路由
"""

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

router = APIRouter(tags=["pages"])

# Initialize templates
templates = Jinja2Templates(directory="web/backend/templates")


@router.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Render the main interface"""
    return templates.TemplateResponse("index.html", {"request": request})


@router.get("/results/{analysis_id}", response_class=HTMLResponse)
async def results_page(request: Request, analysis_id: str):
    """Render the results page for a specific analysis"""
    return templates.TemplateResponse("results.html", {
        "request": request, 
        "analysis_id": analysis_id
    })

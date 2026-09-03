"""
*   This file has been massively slopped. Beware!
*   -Vs1m, 07/2026
"""
from pathlib import Path

from flask      import Blueprint, send_from_directory
from werkzeug.exceptions import NotFound

from api.database import main    as sqlite
from api.database import queries as sqlite_queries


ENDPOINT = "/"
MAIN_BP  = Blueprint( "main", __name__, url_prefix = ENDPOINT )


def _frontend_dir() -> str:
    """
    File-relative frontend dist directory.
    """
    return str(Path(__file__).resolve().parents[1] / "frontend" / "dist")


@MAIN_BP.route( "/health" )
def health():
    """
    Endpoint:
        GET /health

    Returns:
        ("200", 200)
    """
    return "200", 200


@MAIN_BP.route( "/", methods = [ "GET" ] )
def index():
    """
    Endpoint:
        GET /

    Returns:
        frontend/dist/index.html when built, otherwise a placeholder HTML page.
    """

    return send_from_directory( _frontend_dir(), "index.html" )



@MAIN_BP.route( "/<path:path>",  methods = [ "GET" ] )
@MAIN_BP.route( "/<path:path>/", methods = [ "GET" ] )
def spa_fallback( path : str ):
    """
    Endpoint:
        GET /<path>

    Tries to serve a static file from frontend/dist; falls back to index.html
    (SPA fallback) or the placeholder HTML when neither exists.
    """
    try:
    
        return send_from_directory( _frontend_dir(), path )
    
    except ( FileNotFoundError, NotADirectoryError, NotFound ):
        return send_from_directory( _frontend_dir(), "index.html" )
        

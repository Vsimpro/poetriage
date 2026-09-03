"""
*   Poetriage API - shared helpers.
*   -Vs1m, 07/2026
"""
import hashlib, json, threading

from datetime import datetime

from functools   import wraps
from flask       import g, jsonify, request, session
from werkzeug.security import generate_password_hash, check_password_hash

from api.database import main    as sqlite
from api.database import queries as sqlite_queries


#
#   Lock used to serialize MCP-driven analysis runs (single remnux container)
#
ANALYZE_LOCK : threading.Lock = threading.Lock()

REMEMBER_COOKIE_NAME = "poetriage_remember"
REMEMBER_MAX_AGE_SECONDS = 3650 * 24 * 60 * 60


def remember_token_hash( token : str ) -> str:
    return hashlib.sha256( token.encode( "utf-8" ) ).hexdigest()


#
#   Row -> dict helpers
#
def row_to_user_dict( row ) -> dict:
    """
    Maps a Users row tuple to the API's user object.

    Row order: id, username, password_hash, is_admin, is_active, created_at
    """
    return {
        "id"        : row[ 0 ],
        "username"  : row[ 1 ],
        "is_admin"  : bool( row[ 3 ] ),
        "is_active" : bool( row[ 4 ] ),
        "created_at" : row[ 5 ],
    }


def analysis_model_metadata( raw : str | None ) -> dict:
    if not raw:
        return { "provider" : None, "model" : None }

    try:
        data = json.loads( raw )

    except json.JSONDecodeError:
        return { "provider" : None, "model" : None }

    if not isinstance( data, dict ):
        return { "provider" : None, "model" : None }

    return {
        "provider" : data.get( "provider" ),
        "model"    : data.get( "model" ),
    }


def _parse_iso_datetime( value : str | None ):
    if not value:
        return None

    try:
        return datetime.fromisoformat( value )

    except ValueError:
        return None


def analysis_timing_metadata( file_id : str ) -> dict:
    rows = sqlite.query_database(
        sqlite_queries.AnalysisJobs.get_latest_job_by_file_id,
        ( file_id, ),
    )

    if not rows:
        return {
            "analysis_created_at"       : None,
            "analysis_started_at"       : None,
            "analysis_finished_at"      : None,
            "analysis_duration_seconds" : None,
            "analysis_queue_seconds"    : None,
            "analysis_total_seconds"    : None,
        }

    created_at, started_at, finished_at = rows[ 0 ]
    created  = _parse_iso_datetime( created_at )
    started  = _parse_iso_datetime( started_at )
    finished = _parse_iso_datetime( finished_at )

    return {
        "analysis_created_at"       : created_at,
        "analysis_started_at"       : started_at,
        "analysis_finished_at"      : finished_at,
        "analysis_duration_seconds" : ( finished - started ).total_seconds() if started and finished else None,
        "analysis_queue_seconds"    : ( started - created ).total_seconds() if created and started else None,
        "analysis_total_seconds"    : ( finished - created ).total_seconds() if created and finished else None,
    }


def row_to_file_dict( row, include_cost : bool = True ) -> dict:
    """
    Maps a Files row tuple to the API's file object.

    Row order: id, filename, md5, sha256, size, uploaded_at, analysis,
               status, token_count, analysis_cost, owner_user_id, is_public,
               public_token, analysis_json, analysis_context_rot, risk_score,
               analysis_token_count, summary_token_count,
               final_conversation_token_count
    """
    model_metadata  = analysis_model_metadata( row[ 13 ] if len( row ) > 13 else None )
    timing_metadata = analysis_timing_metadata( row[ 0 ] )
    queued_model    = sqlite.query_database(
        sqlite_queries.AnalysisJobs.get_latest_model_by_file_id,
        ( row[ 0 ], ),
    )
    file_data = {
        "id"              : row[ 0  ],
        "filename"        : row[ 1  ],
        "md5"             : row[ 2  ],
        "sha256"          : row[ 3  ],
        "size"            : row[ 4  ],
        "uploaded_at"     : row[ 5  ],
        "analysis"        : row[ 6  ],
        "status"          : row[ 7  ],
        "token_count"     : row[ 8  ],
        "estimated_cost"  : float( row[ 9 ] ),
        "is_public"       : bool( row[ 11 ] ),
        "public_token"    : row[ 12 ],
        "analysis_context_rot" : bool( row[ 14 ] ) if len( row ) > 14 else False,
        "risk_score"      : row[ 15 ] if len( row ) > 15 else None,
        "analysis_token_count" : row[ 16 ] if len( row ) > 16 else 0,
        "summary_token_count"  : row[ 17 ] if len( row ) > 17 else 0,
        "final_conversation_token_count" : row[ 18 ] if len( row ) > 18 else None,
        "provider"        : model_metadata[ "provider" ],
        "model"           : model_metadata[ "model" ],
        "queued_model"    : queued_model[ 0 ][ 0 ] if queued_model else None,
        **timing_metadata,
    }
    if not include_cost:
        file_data.pop( "estimated_cost", None )
    return file_data


#
#   Decorators
#
def login_required( f ):
    """
    Validates that the request has a valid, active session.
    Stashes g.current_user on success.
    """
    @wraps( f )
    def wrapper( *args, **kwargs ):
        user_id = session.get( "user_id" )

        if not user_id:
            remember_token = request.cookies.get( REMEMBER_COOKIE_NAME )
            if remember_token:
                rows = sqlite.query_database(
                    sqlite_queries.Users.get_user_by_remember_token_hash,
                    ( remember_token_hash( remember_token ), datetime.now().isoformat() ),
                )

                if rows:
                    user_id = rows[ 0 ][ 0 ]
                    session.permanent = True
                    session[ "user_id" ] = user_id

        if not user_id:
            print( f"[AUTH][401] {request.path}: no active session" )
            return jsonify( { "status" : "error", "error" : "Authentication required" } ), 401

        rows = sqlite.query_database(
            sqlite_queries.Users.get_user_by_id,
            ( user_id, ),
        )

        if not rows:
            session.clear()
            print( f"[AUTH][401] {request.path}: invalid session user" )
            return jsonify( { "status" : "error", "error" : "Invalid session" } ), 401

        user = rows[ 0 ]

        if not user[ 4 ]:
            return jsonify( { "status" : "error", "error" : "Account deactivated" } ), 403

        g.current_user = row_to_user_dict( user )
        return f( *args, **kwargs )

    return wrapper


def admin_required( f ):
    """
    Validates that the current session user has is_admin == 1.
    Must be stacked under @login_required (write @login_required ABOVE @admin_required).
    """
    @wraps( f )
    def wrapper( *args, **kwargs ):
        current = getattr( g, "current_user", None )

        if not current or not current.get( "is_admin" ):
            return jsonify( { "status" : "error", "error" : "Admin required" } ), 403

        return f( *args, **kwargs )

    return wrapper


#
#   Re-exports so blueprints can keep their import lines short.
#
__all__ = [
    "ANALYZE_LOCK",
    "row_to_user_dict",
    "row_to_file_dict",
    "analysis_model_metadata",
    "analysis_timing_metadata",
    "login_required",
    "admin_required",
    "REMEMBER_COOKIE_NAME",
    "REMEMBER_MAX_AGE_SECONDS",
    "remember_token_hash",
    "generate_password_hash",
    "check_password_hash",
]

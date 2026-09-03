"""
*   This file has been heavily slopped. Beware!
*   -Vs1m, 07/2026
"""
import sqlite3

from flask import Blueprint, g, jsonify, request

from api.database import main    as sqlite
from api.database import queries as sqlite_queries

from api.endpoints import login_required, row_to_file_dict
from src.model_settings import resolve_queue_model


ENDPOINT   = "/api"
ANALYZE_BP = Blueprint( "analyze", __name__, url_prefix = ENDPOINT )

#
#   Endpoint helpers
#
def _queue_counts() -> dict:
    counts = {
        "queued"  : 0,
        "running" : 0,
    }

    rows = sqlite.query_database(
        sqlite_queries.AnalysisJobs.count_jobs_by_status,
    )

    for row in rows:
        counts[ row[ 0 ] ] = row[ 1 ]

    return counts


def _active_job_response( job ):
    return jsonify({
        "status" : "queued" if job[ 2 ] == "queued" else "analyzing",
        "job_id" : job[ 0 ],
        "model"  : job[ 8 ] if len( job ) > 8 else None,
    }), 202


#
#   Endpoint Interface
#
@ANALYZE_BP.route( "/analyze/<sha256>",  methods = [ "POST" ] )
@ANALYZE_BP.route( "/analyze/<sha256>/", methods = [ "POST" ] )
@login_required
def analyze_file( sha256 : str ):
    """
    Queue an analysis job for an owned file.

    Args:
        sha256 (str) : SHA256 hash from the requested file URL.

    Returns:
        tuple : Flask JSON response and HTTP status.
    """
    force = request.args.get( "force" ) == "true"
    data  = request.get_json( silent = True ) or {}

    try:
        model_id = resolve_queue_model( data.get( "model_id" ) )

    except ValueError as e:
        return jsonify( { "status" : "error", "error" : str( e ) } ), 400

    rows = sqlite.query_database(
        sqlite_queries.Files.get_owned_file_by_sha256,
        ( g.current_user[ "id" ], sha256 ),
    )

    if not rows:
        return jsonify( { "status" : "error", "error" : "File not found" } ), 404

    file_row = rows[ 0 ]
    file_id  = file_row[ 0 ]

    active = sqlite.query_database(
        sqlite_queries.AnalysisJobs.get_active_job_by_file_id,
        ( file_id, ),
    )

    if active:
        return _active_job_response( active[ 0 ] )

    if file_row[ 7 ] == "done" and not force:
        return jsonify({
            "status" : "error",
            "error"  : "File has already been analyzed. Use force=true to reanalyze.",
        }), 409

    job = sqlite_queries.create_analysis_job_insert_tuple( file_id, model = model_id )

    try:
        ok = sqlite.insert_data(
            sqlite_queries.AnalysisJobs.insert_analysis_job,
            job,
        )

        if not ok:
            return jsonify( { "status" : "error" } ), 500

        sqlite.update_data(
            sqlite_queries.Files.start_file_analysis_by_id,
            ( "queued", "", 0, 0, file_id ),
        )

    except sqlite3.Error as e:
        print( f"[ANALYZE][!] Queue failed for {sha256}. Error: ", e )
        return jsonify( { "status" : "error" } ), 500

    return jsonify({
        "status" : "queued",
        "job_id" : job[ 0 ],
        "model"  : model_id,
        "file"   : row_to_file_dict( file_row ),
    }), 202


@ANALYZE_BP.route( "/analyze/<sha256>/queue",  methods = [ "DELETE" ] )
@ANALYZE_BP.route( "/analyze/<sha256>/queue/", methods = [ "DELETE" ] )
@login_required
def cancel_queued_analysis( sha256 : str ):
    """
    Remove an owned file from the queued analysis jobs without deleting it.

    Args:
        sha256 (str) : SHA256 hash from the requested file URL.

    Returns:
        tuple : Flask JSON response and HTTP status.
    """
    rows = sqlite.query_database(
        sqlite_queries.Files.get_owned_file_by_sha256,
        ( g.current_user[ "id" ], sha256 ),
    )

    if not rows:
        return jsonify( { "status" : "error", "error" : "File not found" } ), 404

    file_row = rows[ 0 ]
    file_id  = file_row[ 0 ]

    active = sqlite.query_database(
        sqlite_queries.AnalysisJobs.get_active_job_by_file_id,
        ( file_id, ),
    )

    if not active or active[ 0 ][ 2 ] != "queued":
        if active and active[ 0 ][ 2 ] == "running":
            return jsonify( { "status" : "error", "error" : "Analysis is already running." } ), 409

        return jsonify( { "status" : "error", "error" : "File is not queued." } ), 409

    try:
        ok = sqlite.update_data(
            sqlite_queries.AnalysisJobs.delete_queued_job_by_file_id,
            ( file_id, ),
        )

        if not ok:
            return jsonify( { "status" : "error" } ), 500

        active = sqlite.query_database(
            sqlite_queries.AnalysisJobs.get_active_job_by_file_id,
            ( file_id, ),
        )

        if active and active[ 0 ][ 2 ] == "running":
            return jsonify( { "status" : "error", "error" : "Analysis is already running." } ), 409

        sqlite.update_data(
            sqlite_queries.Files.update_file_status_by_id,
            ( "pending", file_id ),
        )

    except sqlite3.Error as e:
        print( f"[ANALYZE][!] Cancel queued analysis failed for {sha256}. Error: ", e )
        return jsonify( { "status" : "error" } ), 500

    rows = sqlite.query_database(
        sqlite_queries.Files.get_owned_file_by_sha256,
        ( g.current_user[ "id" ], sha256 ),
    )

    return jsonify( row_to_file_dict( rows[ 0 ] ) ), 200


@ANALYZE_BP.route( "/analyze/status",  methods = [ "GET" ] )
@ANALYZE_BP.route( "/analyze/status/", methods = [ "GET" ] )
@login_required
#SLOP
def analysis_status():
    """
    Return current global analysis queue status.

    Args:
        None

    Returns:
        tuple : Flask JSON response and HTTP 200 status.
    """
    counts       = _queue_counts()
    current_file = None
    rows         = sqlite.query_database(
        sqlite_queries.AnalysisJobs.get_current_running_file,
    )

    if rows:
        current_file = rows[ 0 ][ 0 ]

    status = "analyzing" if counts[ "running" ] else "queued" if counts[ "queued" ] else "idle"

    return jsonify({
        "status"       : status,
        "queued"       : counts[ "queued" ],
        "running"      : counts[ "running" ],
        "current_file" : current_file,
    }), 200
